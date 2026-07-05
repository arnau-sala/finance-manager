import type { FastifyPluginAsync } from "fastify";

import { getAuthenticatedUser } from "../auth/authenticated-user.js";

export const authMeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/auth/me", async (request, reply) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    return reply.send({ user });
  });
};
