import type { FastifyRequest } from "fastify";

import { db } from "../db/client.js";

export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true
} as const;

export const authenticatedUserSelect = {
  ...publicUserSelect,
  authProvider: true,
  updatedAt: true
} as const;

export async function getAuthenticatedUser(request: FastifyRequest) {
  const sessionUserId = request.session.get("userId");
  const sessionVersion = request.session.get("sessionVersion");

  if (!sessionUserId || sessionVersion === undefined) {
    request.session.delete();
    return null;
  }

  const user = await db.user.findFirst({
    where: {
      id: sessionUserId,
      status: "APPROVED",
      sessionVersion
    },
    select: authenticatedUserSelect
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
