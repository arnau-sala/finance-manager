import type { FastifyReply, FastifyRequest } from "fastify";

import { getAuthenticatedUser } from "./authenticated-user.js";

export async function requireAdministrator(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authenticatedUser = await getAuthenticatedUser(request);

  if (!authenticatedUser) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  if (authenticatedUser.role !== "ADMIN") {
    return reply.code(403).send({ error: "Administrator access required" });
  }
}
