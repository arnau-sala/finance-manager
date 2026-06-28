import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";

const accessRequestBodySchema = z
  .object({
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    name: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(1000)
  })
  .strict();

const neutralResponse = {
  message: "Access request received."
};

export const accessRequestRoutes: FastifyPluginAsync = async (app) => {
  app.post("/access-requests", async (request, reply) => {
    const parsedBody = accessRequestBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "Invalid request body.",
        issues: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const data = parsedBody.data;

    try {
      await db.$transaction(async (transaction) => {
        const [user, approvedEmail, accessRequest] = await Promise.all([
          transaction.user.findUnique({
            where: { email: data.email },
            select: { id: true }
          }),
          transaction.approvedEmail.findUnique({
            where: { email: data.email },
            select: { id: true }
          }),
          transaction.accessRequest.findUnique({
            where: { email: data.email },
            select: { id: true }
          })
        ]);

        if (user) {
          await transaction.accessRequestEvent.create({
            data: {
              ...data,
              type: "ACCESS_REQUEST_DISCARDED",
              discardReason: "EMAIL_ALREADY_REGISTERED",
              actorType: "SYSTEM"
            }
          });
          return;
        }

        if (approvedEmail || accessRequest) {
          await transaction.accessRequestEvent.create({
            data: {
              ...data,
              type: "ACCESS_REQUEST_DISCARDED",
              discardReason: "ACCESS_REQUEST_ALREADY_EXISTS",
              actorType: "SYSTEM"
            }
          });
          return;
        }

        const createdAccessRequest = await transaction.accessRequest.create({
          data
        });

        await transaction.accessRequestEvent.create({
          data: {
            ...data,
            accessRequestId: createdAccessRequest.id,
            type: "ACCESS_REQUEST_CREATED",
            actorType: "VISITOR"
          }
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        await db.accessRequestEvent.create({
          data: {
            ...data,
            type: "ACCESS_REQUEST_DISCARDED",
            discardReason: "ACCESS_REQUEST_ALREADY_EXISTS",
            actorType: "SYSTEM"
          }
        });
        return reply.code(202).send(neutralResponse);
      }

      throw error;
    }

    return reply.code(202).send(neutralResponse);
  });
};
