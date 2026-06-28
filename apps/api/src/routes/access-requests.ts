import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";

const accessRequestBodySchema = z
  .object({
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    name: z.string().trim().min(1).max(100).optional(),
    message: z.string().trim().min(1).max(1000).optional()
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

    const { email, name, message } = parsedBody.data;
    const [user, approvedEmail, accessRequest] = await db.$transaction([
      db.user.findUnique({ where: { email }, select: { id: true } }),
      db.approvedEmail.findUnique({ where: { email }, select: { id: true } }),
      db.accessRequest.findFirst({ where: { email }, select: { id: true } })
    ]);

    if (user || approvedEmail || accessRequest) {
      return reply.code(202).send(neutralResponse);
    }

    try {
      await db.accessRequest.create({
        data: { email, name, message }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return reply.code(202).send(neutralResponse);
      }

      throw error;
    }

    return reply.code(202).send(neutralResponse);
  });
};
