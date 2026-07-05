import type { FastifyPluginAsync } from "fastify";

import { getAuthenticatedUser } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/accounts", async (request, reply) => {
    const authenticatedUser = await getAuthenticatedUser(request);

    if (!authenticatedUser) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    if (authenticatedUser.role !== "ADMIN") {
      return reply.code(403).send({ error: "Administrator access required." });
    }

    const accounts = await db.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    return reply.send({ accounts });
  });
};
