import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { publicUserSelect } from "../auth/authenticated-user.js";
import { requireAdministrator } from "../auth/require-administrator.js";
import { db } from "../db/client.js";
import { adminRateLimit } from "../security/rate-limit.js";

const userIdParamsSchema = z
  .object({
    id: z.cuid(),
  })
  .strict();

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.rateLimit(adminRateLimit));
  app.addHook("preHandler", requireAdministrator);

  app.get("/admin/users", async (_request, reply) => {
    const users = await db.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
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
      select: publicUserSelect,
    });

    if (!user) {
      return reply.code(404).send({ error: "User not found." });
    }

    return reply.send({ user });
  });
};
