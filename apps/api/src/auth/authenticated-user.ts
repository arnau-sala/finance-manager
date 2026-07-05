import type { FastifyRequest } from "fastify";

import { db } from "../db/client.js";

export const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true
} as const;

const authenticatedUserSelect = {
  ...publicUserSelect,
  updatedAt: true
} as const;

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
