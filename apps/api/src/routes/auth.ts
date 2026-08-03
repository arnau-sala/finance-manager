import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { supportsPasswordAuthentication } from "../auth/auth-provider.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { passwordSchema } from "../auth/password-validation.js";
import {
  beginPasswordRegistration,
  EmailConfigurationError,
  EmailDeliveryError,
  genericRegistrationResponse,
  resendPasswordRegistrationCode,
  verifyPasswordRegistration,
} from "../auth/registration.js";
import { userNameSchema } from "../auth/user-validation.js";
import { db } from "../db/client.js";
import {
  authLoginRateLimit,
  authLogoutRateLimit,
  authRegisterRateLimit,
  authRegistrationVerifyRateLimit,
} from "../security/rate-limit.js";

const registerBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    name: userNameSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .strict()
  .superRefine(({ password, passwordConfirmation }, context) => {
    if (password !== passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "Passwords do not match.",
      });
    }
  });

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

const resendRegistrationBodySchema = z
  .object({ email: emailSchema })
  .strict();

const verifyRegistrationBodySchema = z
  .object({
    email: emailSchema,
    code: z.string().trim().regex(/^\d{6}$/),
  })
  .strict();

const invalidVerificationCodeResponse = {
  error: "Invalid or expired verification code.",
};

const loginBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();

const invalidCredentialsResponse = {
  error: "Invalid email or password.",
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  const dummyPasswordHash = await hashPassword("Dummy-password1!");

  app.post(
    "/auth/register",
    { config: { rateLimit: authRegisterRateLimit } },
    async (request, reply) => {
      const parsedBody = registerBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid registration data.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { email, name, password } = parsedBody.data;

      try {
        await beginPasswordRegistration({
          email,
          name,
          password,
        });
      } catch (error) {
        if (error instanceof EmailConfigurationError) {
          request.log.error(error, "Email verification is not configured.");
          return reply.code(503).send({
            error: "Email verification is not configured.",
          });
        }

        if (error instanceof EmailDeliveryError) {
          request.log.error(error, "Verification email delivery failed.");
          return reply.code(503).send({
            error: "Verification email could not be sent. Please try again.",
          });
        }

        throw error;
      }

      return reply.code(202).send(genericRegistrationResponse);
    },
  );

  app.post(
    "/auth/register/resend",
    { config: { rateLimit: authRegisterRateLimit } },
    async (request, reply) => {
      const parsedBody = resendRegistrationBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Invalid email address." });
      }

      try {
        await resendPasswordRegistrationCode(parsedBody.data.email);
      } catch (error) {
        if (error instanceof EmailConfigurationError) {
          request.log.error(error, "Email verification is not configured.");
          return reply.code(503).send({
            error: "Email verification is not configured.",
          });
        }

        if (error instanceof EmailDeliveryError) {
          request.log.error(error, "Verification email delivery failed.");
          return reply.code(503).send({
            error: "Verification email could not be sent. Please try again.",
          });
        }

        throw error;
      }

      return reply.code(202).send(genericRegistrationResponse);
    },
  );

  app.post(
    "/auth/register/verify",
    { config: { rateLimit: authRegistrationVerifyRateLimit } },
    async (request, reply) => {
      const parsedBody = verifyRegistrationBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send(invalidVerificationCodeResponse);
      }

      let result;

      try {
        result = await verifyPasswordRegistration(
          parsedBody.data.email,
          parsedBody.data.code,
        );
      } catch (error) {
        if (error instanceof EmailConfigurationError) {
          request.log.error(error, "Email verification is not configured.");
          return reply.code(503).send({
            error: "Email verification is not configured.",
          });
        }

        throw error;
      }

      if (result.type === "invalid") {
        return reply.code(400).send(invalidVerificationCodeResponse);
      }

      if (result.type === "account-exists") {
        return reply.code(409).send({
          error: "An account already exists for this email.",
        });
      }

      request.session.regenerate();
      request.session.set("userId", result.user.id);
      request.session.set("sessionVersion", result.sessionVersion);

      return reply.code(201).send({
        message: "Account created successfully.",
        user: result.user,
      });
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: authLoginRateLimit } },
    async (request, reply) => {
      const parsedBody = loginBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Invalid login data." });
      }

      const { email, password } = parsedBody.data;
      const user = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          passwordHash: true,
          authProvider: true,
          status: true,
          sessionVersion: true,
        },
      });

      const userCanUsePassword =
        user !== null &&
        supportsPasswordAuthentication(user.authProvider) &&
        Boolean(user.passwordHash);
      const passwordMatches = await verifyPassword(
        userCanUsePassword ? user.passwordHash! : dummyPasswordHash,
        password,
      );

      if (
        !user ||
        !userCanUsePassword ||
        !passwordMatches ||
        user.status !== "APPROVED"
      ) {
        return reply.code(401).send(invalidCredentialsResponse);
      }

      request.session.regenerate();
      request.session.set("userId", user.id);
      request.session.set("sessionVersion", user.sessionVersion);

      return reply.send({ message: "Login successful." });
    },
  );

  app.post(
    "/auth/logout",
    { config: { rateLimit: authLogoutRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");

      if (!userId) {
        return reply.code(401).send({ error: "No active session." });
      }

      request.session.delete();

      return reply.send({ message: "Logout successful." });
    },
  );
};
