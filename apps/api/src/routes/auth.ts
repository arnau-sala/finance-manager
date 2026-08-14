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
import {
  normalizeLoginIdentifier,
  usernameSchema,
} from "../auth/username-validation.js";
import {
  registerUsernameAccount,
} from "../auth/username-account.js";
import { db } from "../db/client.js";
import {
  authLoginRateLimit,
  authLogoutRateLimit,
  authRegisterRateLimit,
  authRegistrationVerifyRateLimit,
  authUsernameAvailabilityRateLimit,
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
    legalAccepted: z.literal(true),
  })
  .strict()
  .superRefine(({ password, passwordConfirmation }, context) => {
    if (password !== passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "Passwords do not match",
      });
    }
  });

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

const usernameRegisterBodySchema = z
  .object({
    username: usernameSchema,
    name: userNameSchema,
    password: passwordSchema,
    passwordConfirmation: z.string().max(128),
    legalAccepted: z.literal(true),
  })
  .strict()
  .superRefine(({ password, passwordConfirmation }, context) => {
    if (password !== passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "Passwords do not match",
      });
    }
  });

const usernameAvailabilityParamsSchema = z
  .object({ username: usernameSchema })
  .strict();

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
  error: "Invalid or expired verification code",
};

const loginIdentifierSchema = z.union([emailSchema, usernameSchema]);

const loginBodySchema = z.union([
  z
    .object({
      identifier: loginIdentifierSchema,
      password: z.string().min(1).max(128),
    })
    .strict()
    .transform(({ identifier, password }) => ({ identifier, password })),
  z
    .object({
      email: emailSchema,
      password: z.string().min(1).max(128),
    })
    .strict()
    .transform(({ email, password }) => ({ identifier: email, password })),
]);

const browserLoginBodySchema = z
  .object({
    username: loginIdentifierSchema,
    password: z.string().min(1).max(128),
  })
  .passthrough();

const invalidCredentialsResponse = {
  error: "Invalid identifier or password",
};

let dummyPasswordHashPromise: ReturnType<typeof hashPassword> | undefined;

function getDummyPasswordHash() {
  dummyPasswordHashPromise ??= hashPassword("Dummy-password1!");
  return dummyPasswordHashPromise;
}

async function authenticatePasswordUser(
  identifier: string,
  password: string,
) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  const user = await db.user.findUnique({
    where: normalizedIdentifier.includes("@")
      ? { email: normalizedIdentifier }
      : { username: normalizedIdentifier },
    select: {
      id: true,
      passwordHash: true,
      authProvider: true,
      emailLoginEnabled: true,
      status: true,
      sessionVersion: true,
    },
  });

  const userCanUsePassword =
    user !== null &&
    supportsPasswordAuthentication(user.authProvider) &&
    (!normalizedIdentifier.includes("@") || user.emailLoginEnabled) &&
    Boolean(user.passwordHash);
  const passwordHash = userCanUsePassword
    ? user.passwordHash!
    : await getDummyPasswordHash();
  const passwordMatches = await verifyPassword(
    passwordHash,
    password,
  );

  if (
    !user ||
    !userCanUsePassword ||
    !passwordMatches ||
    user.status !== "APPROVED"
  ) {
    return null;
  }

  return user;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/auth/usernames/:username/availability",
    { config: { rateLimit: authUsernameAvailabilityRateLimit } },
    async (request, reply) => {
      const parsedParams = usernameAvailabilityParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.code(400).send({
          error: "Invalid username",
          issues: parsedParams.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const user = await db.user.findUnique({
        where: { username: parsedParams.data.username },
        select: { id: true },
      });

      return reply.send({ available: user === null });
    },
  );

  app.post(
    "/auth/register",
    { config: { rateLimit: authRegisterRateLimit } },
    async (request, reply) => {
      const parsedBody = registerBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid registration data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { email, name, password, legalAccepted } = parsedBody.data;

      try {
        await beginPasswordRegistration({
          email,
          name,
          password,
          legalAccepted,
        });
      } catch (error) {
        if (error instanceof EmailConfigurationError) {
          request.log.error(error, "Email verification is not configured");
          return reply.code(503).send({
            error: "Email verification is not configured",
          });
        }

        if (error instanceof EmailDeliveryError) {
          request.log.error(error, "Verification email delivery failed");
          return reply.code(503).send({
            error: "Verification email could not be sent\nPlease try again",
          });
        }

        throw error;
      }

      return reply.code(202).send(genericRegistrationResponse);
    },
  );

  app.post(
    "/auth/register/username",
    { config: { rateLimit: authRegisterRateLimit } },
    async (request, reply) => {
      const parsedBody = usernameRegisterBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid registration data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { username, name, password, legalAccepted } = parsedBody.data;
      const result = await registerUsernameAccount({
        username,
        name,
        password,
        legalAccepted,
      });

      if (result.type === "username-unavailable") {
        return reply.code(409).send({ error: "Username is unavailable" });
      }

      request.session.regenerate();
      request.session.set("userId", result.user.id);
      request.session.set("sessionVersion", result.sessionVersion);
      reply.header("Cache-Control", "no-store");

      return reply.code(201).send({
        message: "Account created successfully",
        user: result.user,
        recoveryCode: result.recoveryCode,
      });
    },
  );

  app.post(
    "/auth/register/resend",
    { config: { rateLimit: authRegisterRateLimit } },
    async (request, reply) => {
      const parsedBody = resendRegistrationBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Invalid email address" });
      }

      try {
        await resendPasswordRegistrationCode(parsedBody.data.email);
      } catch (error) {
        if (error instanceof EmailConfigurationError) {
          request.log.error(error, "Email verification is not configured");
          return reply.code(503).send({
            error: "Email verification is not configured",
          });
        }

        if (error instanceof EmailDeliveryError) {
          request.log.error(error, "Verification email delivery failed");
          return reply.code(503).send({
            error: "Verification email could not be sent\nPlease try again",
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
          request.log.error(error, "Email verification is not configured");
          return reply.code(503).send({
            error: "Email verification is not configured",
          });
        }

        throw error;
      }

      if (result.type === "invalid") {
        return reply.code(400).send(invalidVerificationCodeResponse);
      }

      if (result.type === "account-exists") {
        return reply.code(409).send({
          error: "An account already exists for this email",
        });
      }

      request.session.regenerate();
      request.session.set("userId", result.user.id);
      request.session.set("sessionVersion", result.sessionVersion);

      return reply.code(201).send({
        message: "Account created successfully",
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
        return reply.code(400).send({ error: "Invalid login data" });
      }

      const { identifier, password } = parsedBody.data;
      const user = await authenticatePasswordUser(
        identifier,
        password,
      );

      if (!user) {
        return reply.code(401).send(invalidCredentialsResponse);
      }

      request.session.regenerate();
      request.session.set("userId", user.id);
      request.session.set("sessionVersion", user.sessionVersion);

      return reply.send({ message: "Login successful" });
    },
  );

  app.post(
    "/auth/login/browser",
    { config: { rateLimit: authLoginRateLimit } },
    async (request, reply) => {
      const parsedBody = browserLoginBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Invalid login data" });
      }

      const user = await authenticatePasswordUser(
        parsedBody.data.username,
        parsedBody.data.password,
      );

      if (!user) {
        return reply.code(401).send(invalidCredentialsResponse);
      }

      request.session.regenerate();
      request.session.set("userId", user.id);
      request.session.set("sessionVersion", user.sessionVersion);

      return reply.code(303).redirect("/");
    },
  );

  app.post(
    "/auth/logout",
    { config: { rateLimit: authLogoutRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");

      if (!userId) {
        return reply.code(401).send({ error: "No active session" });
      }

      request.session.delete();

      return reply.send({ message: "Logout successful" });
    },
  );
};
