import type { Prisma } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

export const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  role: true,
  status: true,
  createdAt: true
} as const;

export const authenticatedUserSelect = {
  ...publicUserSelect,
  authProvider: true,
  emailLoginEnabled: true,
  sessionVersion: true,
  startingNetWorthCents: true,
  updatedAt: true
} as const;

type AuthenticatedUser = Prisma.UserGetPayload<{
  select: typeof authenticatedUserSelect;
}>;

export function toAuthenticatedUserResponse(user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    authProvider: user.authProvider,
    emailLoginEnabled: user.emailLoginEnabled,
    role: user.role,
    status: user.status,
    startingNetWorth:
      user.startingNetWorthCents === null
        ? null
        : centsToDecimal(user.startingNetWorthCents),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt?.toISOString() ?? null
  };
}

export async function getAuthenticatedUser(request: FastifyRequest) {
  const sessionUserId = request.session.get("userId");
  const sessionVersion = request.session.get("sessionVersion");

  if (!sessionUserId) {
    return null;
  }

  if (sessionVersion === undefined) {
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
