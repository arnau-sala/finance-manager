import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  beginAccountEmailLink,
  genericEmailLinkResponse,
  resendAccountEmailLinkCode,
  verifyAccountEmailLink,
} from "../account/email-link.js";
import {
  authenticatedUserSelect,
  toAuthenticatedUserResponse,
} from "../auth/authenticated-user.js";
import { passwordSchema } from "../auth/password-validation.js";
import {
  EmailConfigurationError,
  EmailDeliveryError,
} from "../email/brevo.js";
import { db } from "../db/client.js";
import {
  accountEmailLinkVerifyRateLimit,
  accountLinkRateLimit,
} from "../security/rate-limit.js";

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

const beginEmailLinkBodySchema = z.union([
  z.object({ email: emailSchema }).strict(),
  z
    .object({
      password: passwordSchema,
      passwordConfirmation: z.string().max(128),
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
    }),
  z.object({}).strict(),
]);
const verifyEmailLinkBodySchema = z
  .object({ code: z.string().trim().regex(/^\d{6}$/) })
  .strict();

export const accountEmailRoutes: FastifyPluginAsync = async (app) => {
  app.delete(
    "/account/email/link",
    { config: { rateLimit: accountLinkRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const user = await db.user.findUnique({
        where: { id: userId, sessionVersion, status: "APPROVED" },
        select: { id: true },
      });

      if (!user) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      await db.pendingEmailLink.deleteMany({ where: { userId } });
      return reply.code(204).send();
    },
  );

  app.post(
    "/account/email/link",
    { config: { rateLimit: accountLinkRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = beginEmailLinkBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Invalid email linking details." });
      }

      try {
        const result = await beginAccountEmailLink({
          userId,
          sessionVersion,
          ...("email" in parsedBody.data
            ? { email: parsedBody.data.email }
            : {}),
          ...("password" in parsedBody.data
            ? { password: parsedBody.data.password }
            : {}),
        });

        if (result.type === "unauthenticated") {
          request.session.delete();
          return reply.code(401).send({ error: "Authentication required." });
        }

        if (result.type === "unavailable") {
          return reply.code(409).send({
            error: "This account already has a linked email.",
          });
        }

        if (result.type === "invalid-request") {
          return reply.code(400).send({
            error: "Invalid email linking details.",
          });
        }
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

      return reply.code(202).send(genericEmailLinkResponse);
    },
  );

  app.post(
    "/account/email/link/resend",
    { config: { rateLimit: accountLinkRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      try {
        const result = await resendAccountEmailLinkCode({
          userId,
          sessionVersion,
        });

        if (result.type === "unauthenticated") {
          request.session.delete();
          return reply.code(401).send({ error: "Authentication required." });
        }
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

      return reply.code(202).send(genericEmailLinkResponse);
    },
  );

  app.post(
    "/account/email/link/verify",
    { config: { rateLimit: accountEmailLinkVerifyRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = verifyEmailLinkBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid or expired verification code.",
        });
      }

      let result;

      try {
        result = await verifyAccountEmailLink({
          userId,
          sessionVersion,
          code: parsedBody.data.code,
        });
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
        return reply.code(400).send({
          error: "Invalid or expired verification code.",
        });
      }

      if (result.type === "unauthenticated") {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (result.type === "unavailable") {
        return reply.code(409).send({ error: "Email could not be linked." });
      }

      const user = await db.user.findUnique({
        where: { id: userId, sessionVersion, status: "APPROVED" },
        select: authenticatedUserSelect,
      });

      if (!user) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      return reply.send({
        message: "Email linked successfully.",
        user: toAuthenticatedUserResponse(user),
      });
    },
  );
};
