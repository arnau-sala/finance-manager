import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { hashPassword, verifyPassword } from "../auth/password.js";
import { db } from "../db/client.js";
import {
  authLoginRateLimit,
  authLogoutRateLimit,
  authRegisterRateLimit,
} from "../security/rate-limit.js";

const passwordSchema = z
  .string()
  .min(9, "Password must contain more than 8 characters.")
  .max(128, "Password must contain at most 128 characters.")
  .regex(/\p{Lu}/u, "Password must contain at least one uppercase letter.")
  .regex(/\p{Nd}/u, "Password must contain at least one digit.")
  .regex(
    /(?:\p{P}|\p{S})/u,
    "Password must contain at least one special character.",
  );

const registerBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
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

const registrationUnavailableResponse = {
  error: "Registration is not available for this email.",
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

      const { email, password } = parsedBody.data;

      try {
        const user = await db.$transaction(async (transaction) => {
          const [existingUser, approvedEmail] = await Promise.all([
            transaction.user.findUnique({
              where: { email },
              select: { id: true },
            }),
            transaction.approvedEmail.findUnique({
              where: { email },
              select: { id: true, usedAt: true },
            }),
          ]);

          if (existingUser || !approvedEmail || approvedEmail.usedAt) {
            return null;
          }

          const approvalClaim = await transaction.approvedEmail.updateMany({
            where: {
              id: approvedEmail.id,
              usedAt: null,
            },
            data: { usedAt: new Date() },
          });

          if (approvalClaim.count !== 1) {
            return null;
          }

          const passwordHash = await hashPassword(password);

          return transaction.user.create({
            data: {
              email,
              passwordHash,
              role: "USER",
              status: "APPROVED",
              updatedAt: null,
            },
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              createdAt: true,
            },
          });
        });

        if (!user) {
          return reply.code(403).send(registrationUnavailableResponse);
        }

        return reply.code(201).send({ user });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return reply.code(403).send(registrationUnavailableResponse);
        }

        throw error;
      }
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
          status: true,
        },
      });

      const passwordMatches = await verifyPassword(
        user?.passwordHash ?? dummyPasswordHash,
        password,
      );

      if (!user || !passwordMatches || user.status !== "APPROVED") {
        return reply.code(401).send(invalidCredentialsResponse);
      }

      request.session.regenerate();
      request.session.set("userId", user.id);

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
