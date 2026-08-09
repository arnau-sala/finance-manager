import type { FastifyPluginAsync } from "fastify";

import {
  getAuthenticatedUser,
  toAuthenticatedUserResponse,
} from "../auth/authenticated-user.js";
import { financialReadRateLimit } from "../security/rate-limit.js";

export const authMeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/auth/me",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      return reply.send({ user: toAuthenticatedUserResponse(user) });
    },
  );
};
