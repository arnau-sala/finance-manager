import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { publicUserSelect } from "../auth/authenticated-user.js";
import { requireAdministrator } from "../auth/require-administrator.js";
import { db } from "../db/client.js";
import {
  getPaginatedResponse,
  getPaginationQuerySchema,
} from "../pagination.js";
import { adminRateLimit } from "../security/rate-limit.js";

const usersPaginationQuerySchema = getPaginationQuerySchema({
  defaultLimit: 50,
  maxLimit: 100,
});

const userIdParamsSchema = z
  .object({
    id: z.cuid(),
  })
  .strict();

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.rateLimit(adminRateLimit));
  app.addHook("preHandler", requireAdministrator);

  app.get("/admin/users", async (request, reply) => {
    const parsedQuery = usersPaginationQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({ error: "Invalid pagination query" });
    }

    const { limit, offset } = parsedQuery.data;
    const users = await db.user.findMany({
      select: publicUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      skip: offset,
    });
    const paginatedUsers = getPaginatedResponse(users, limit, offset);

    return reply.send({
      users: paginatedUsers.items,
      pagination: paginatedUsers.pagination,
    });
  });

  app.get("/admin/users/:id", async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    const user = await db.user.findUnique({
      where: { id: parsedParams.data.id },
      select: publicUserSelect,
    });

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    return reply.send({ user });
  });
};
