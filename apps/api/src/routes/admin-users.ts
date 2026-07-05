import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  getAuthenticatedUser,
  publicUserSelect
} from "../auth/authenticated-user.js";
import { db } from "../db/client.js";

const userIdParamsSchema = z
  .object({
    id: z.cuid()
  })
  .strict();

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const authenticatedUser = await getAuthenticatedUser(request);

    if (!authenticatedUser) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    if (authenticatedUser.role !== "ADMIN") {
      return reply.code(403).send({ error: "Administrator access required." });
    }
  });

  app.get("/admin/users", async (_request, reply) => {
    const users = await db.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: "desc" }
    });

    return reply.send({ users });
  });

  app.get("/admin/users/:id", async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid user id." });
    }

    const user = await db.user.findUnique({
      where: { id: parsedParams.data.id },
      select: publicUserSelect
    });

    if (!user) {
      return reply.code(404).send({ error: "User not found." });
    }

    return reply.send({ user });
  });
};
