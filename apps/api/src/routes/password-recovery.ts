import { randomInt } from "node:crypto";

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  beginEmailPasswordReset,
  completePasswordReset,
  deliverPasswordRecoveryEmail,
  genericPasswordResetResponse,
  notifyPasswordChanged,
  revokePasswordResetGrant,
  verifyAccountRecoveryCode,
  verifyEmailPasswordResetCode,
} from "../auth/password-recovery.js";
import { passwordSchema } from "../auth/password-validation.js";
import { recoveryCodeSchema } from "../auth/recovery-code.js";
import { usernameSchema } from "../auth/username-validation.js";
import { EmailConfigurationError } from "../email/brevo.js";
import {
  authPasswordResetCompleteRateLimit,
  authPasswordResetRecoveryCodeRateLimit,
  authPasswordResetRequestRateLimit,
  authPasswordResetVerifyRateLimit,
} from "../security/rate-limit.js";

const RESET_COOKIE_NAME = "finance_manager_password_reset";
const RESET_COOKIE_MAX_AGE_SECONDS = 10 * 60;
const MINIMUM_REQUEST_DURATION_MS = 300;

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

const emailRequestBodySchema = z.object({ email: emailSchema }).strict();
const emailCodeBodySchema = z
  .object({
    email: emailSchema,
    code: z.string().trim().regex(/^\d{6}$/),
  })
  .strict();
const recoveryCodeBodySchema = z
  .object({
    username: usernameSchema.optional(),
    recoveryCode: recoveryCodeSchema,
  })
  .strict();
const completeBodySchema = z
  .object({
    newPassword: passwordSchema,
    newPasswordConfirmation: z.string().max(128),
  })
  .strict()
  .superRefine(({ newPassword, newPasswordConfirmation }, context) => {
    if (newPassword !== newPasswordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["newPasswordConfirmation"],
        message: "Passwords do not match.",
      });
    }
  });

function getCookie(request: FastifyRequest, name: string) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = cookie.slice(0, separatorIndex).trim();

    if (cookieName === name) {
      return cookie.slice(separatorIndex + 1).trim() || null;
    }
  }

  return null;
}

function resetCookieAttributes(maxAge: number) {
  return [
    "Path=/api/auth/password-reset",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

function setResetCookie(reply: FastifyReply, token: string) {
  reply.header(
    "Set-Cookie",
    `${RESET_COOKIE_NAME}=${token}; ${resetCookieAttributes(
      RESET_COOKIE_MAX_AGE_SECONDS,
    )}`,
  );
}

function clearResetCookie(reply: FastifyReply) {
  reply.header(
    "Set-Cookie",
    `${RESET_COOKIE_NAME}=; ${resetCookieAttributes(0)}`,
  );
}

async function waitForNeutralResponse(startedAt: number) {
  const targetDuration = MINIMUM_REQUEST_DURATION_MS + randomInt(0, 101);
  const remaining = targetDuration - (Date.now() - startedAt);

  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

function dispatchRecoveryEmail(
  delivery: Awaited<ReturnType<typeof beginEmailPasswordReset>>,
  request: FastifyRequest,
) {
  if (!delivery) {
    return;
  }

  void deliverPasswordRecoveryEmail(delivery).catch((error) => {
    request.log.error(error, "Password recovery email delivery failed.");
  });
}

async function handleEmailResetRequest(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const startedAt = Date.now();
  const parsedBody = emailRequestBodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return reply.code(400).send({ error: "Invalid email address." });
  }

  try {
    const delivery = await beginEmailPasswordReset(parsedBody.data.email);
    dispatchRecoveryEmail(delivery, request);
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      request.log.error(error, "Password recovery email is not configured.");
      await waitForNeutralResponse(startedAt);
      return reply.code(503).send({
        error: "Password recovery email is not configured.",
      });
    }

    throw error;
  }

  await waitForNeutralResponse(startedAt);
  reply.header("Cache-Control", "no-store");
  return reply.code(202).send(genericPasswordResetResponse);
}

export const passwordRecoveryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });

  app.post(
    "/auth/password-reset/email/request",
    { config: { rateLimit: authPasswordResetRequestRateLimit } },
    handleEmailResetRequest,
  );

  app.post(
    "/auth/password-reset/email/resend",
    { config: { rateLimit: authPasswordResetRequestRateLimit } },
    handleEmailResetRequest,
  );

  app.post(
    "/auth/password-reset/email/verify",
    { config: { rateLimit: authPasswordResetVerifyRateLimit } },
    async (request, reply) => {
      const parsedBody = emailCodeBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({ error: "Invalid or expired verification code." });
      }

      let result;

      try {
        result = await verifyEmailPasswordResetCode(
          parsedBody.data.email,
          parsedBody.data.code,
        );
      } catch (error) {
        if (error instanceof EmailConfigurationError) {
          request.log.error(
            error,
            "Password recovery verification is not configured.",
          );
          return reply.code(503).send({
            error: "Password recovery email is not configured.",
          });
        }

        throw error;
      }

      if (result.type === "invalid") {
        return reply
          .code(400)
          .send({ error: "Invalid or expired verification code." });
      }

      setResetCookie(reply, result.token);
      reply.header("Cache-Control", "no-store");
      return reply.send({ message: "Recovery code verified." });
    },
  );

  app.post(
    "/auth/password-reset/recovery-code/verify",
    { config: { rateLimit: authPasswordResetRecoveryCodeRateLimit } },
    async (request, reply) => {
      const parsedBody = recoveryCodeBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(401).send({ error: "Invalid recovery code." });
      }

      const result = await verifyAccountRecoveryCode(parsedBody.data);

      if (result.type === "invalid" || !result.username) {
        return reply.code(401).send({ error: "Invalid recovery code." });
      }

      setResetCookie(reply, result.token);
      reply.header("Cache-Control", "no-store");
      return reply.send({
        message: "Recovery code verified.",
        username: result.username,
      });
    },
  );

  app.post(
    "/auth/password-reset/complete",
    { config: { rateLimit: authPasswordResetCompleteRateLimit } },
    async (request, reply) => {
      const parsedBody = completeBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid password data.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const token = getCookie(request, RESET_COOKIE_NAME);

      if (!token) {
        clearResetCookie(reply);
        return reply.code(401).send({
          error: "Recovery session expired. Start again.",
        });
      }

      const result = await completePasswordReset({
        token,
        newPassword: parsedBody.data.newPassword,
      });

      if (result.type === "invalid") {
        clearResetCookie(reply);
        return reply.code(401).send({
          error: "Recovery session expired. Start again.",
        });
      }

      if (result.type === "password-unchanged") {
        return reply.code(400).send({
          error: "New password must be different from current password.",
        });
      }

      request.session.delete();
      clearResetCookie(reply);
      reply.header("Cache-Control", "no-store");

      if (result.notification) {
        void notifyPasswordChanged(result.notification).catch((error) => {
          request.log.error(error, "Password change notification failed.");
        });
      }

      return reply.send({
        message: "Password changed successfully.",
        username: result.username,
        recoveryCode: result.recoveryCode,
      });
    },
  );

  app.post(
    "/auth/password-reset/cancel",
    { config: { rateLimit: authPasswordResetCompleteRateLimit } },
    async (request, reply) => {
      const token = getCookie(request, RESET_COOKIE_NAME);

      if (token) {
        await revokePasswordResetGrant(token);
      }

      clearResetCookie(reply);
      return reply.code(204).send();
    },
  );
};
