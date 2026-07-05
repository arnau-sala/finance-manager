import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { hashPassword } from "../auth/password.js";
import { db } from "../db/client.js";

const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    password: z.string().min(12).max(128)
  })
  .strict();

const registrationUnavailableResponse = {
  error: "Registration is not available for this email."
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (request, reply) => {
    const parsedBody = registerBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "Invalid registration data.",
        issues: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const { email, password } = parsedBody.data;
    const passwordHash = await hashPassword(password);

    try {
      const user = await db.$transaction(async (transaction) => {
        const [existingUser, approvedEmail] = await Promise.all([
          transaction.user.findUnique({
            where: { email },
            select: { id: true }
          }),
          transaction.approvedEmail.findUnique({
            where: { email },
            select: { id: true, usedAt: true }
          })
        ]);

        if (existingUser || !approvedEmail || approvedEmail.usedAt) {
          return null;
        }

        const approvalClaim = await transaction.approvedEmail.updateMany({
          where: {
            id: approvedEmail.id,
            usedAt: null
          },
          data: { usedAt: new Date() }
        });

        if (approvalClaim.count !== 1) {
          return null;
        }

        return transaction.user.create({
          data: {
            email,
            passwordHash,
            role: "USER",
            status: "APPROVED"
          },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            createdAt: true
          }
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
  });
};
