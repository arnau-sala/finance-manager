import type { FastifyRequest } from "fastify";

import { db } from "../db/client.js";

export async function getAuthenticatedUser(request: FastifyRequest) {
  const sessionUserId = request.session.get("userId");

  if (!sessionUserId) {
    return null;
  }

  const user = await db.user.findFirst({
    where: {
      id: sessionUserId,
      status: "APPROVED"
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!user) {
    request.session.delete();
    return null;
  }

  return user;
}

export async function getAuthenticatedUserId(request: FastifyRequest) {
  const user = await getAuthenticatedUser(request);
  return user?.id ?? null;
}
