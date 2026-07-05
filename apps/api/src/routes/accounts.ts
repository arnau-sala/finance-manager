import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAuthenticatedUser } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";

const accountIdParamsSchema = z
  .object({
    id: z.cuid()
  })
  .strict();

const publicAccountSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true
} as const;

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const authenticatedUser = await getAuthenticatedUser(request);

    if (!authenticatedUser) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    if (authenticatedUser.role !== "ADMIN") {
      return reply.code(403).send({ error: "Administrator access required." });
    }
  });

  app.get("/accounts", async (_request, reply) => {
    const accounts = await db.user.findMany({
      select: publicAccountSelect,
      orderBy: { createdAt: "desc" }
    });

    return reply.send({ accounts });
  });

  app.get("/accounts/:id", async (request, reply) => {
    const parsedParams = accountIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid account id." });
    }

    const account = await db.user.findUnique({
      where: { id: parsedParams.data.id },
      select: publicAccountSelect
    });

    if (!account) {
      return reply.code(404).send({ error: "Account not found." });
    }

    return reply.send({ account });
  });
};
