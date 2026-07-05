import type { FastifyPluginAsync } from "fastify";

import { getAuthenticatedUser } from "../auth/authenticated-user.js";

export const myAccountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/myaccount", async (request, reply) => {
    const account = await getAuthenticatedUser(request);

    if (!account) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    return reply.send({ account });
  });
};
