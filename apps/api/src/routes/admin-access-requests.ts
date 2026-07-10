import type { AccessRequest, AccessRequestEvent } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAuthenticatedUser } from "../auth/authenticated-user.js";
import { requireAdministrator } from "../auth/require-administrator.js";
import { db } from "../db/client.js";
import {
  getPaginatedResponse,
  getPaginationQuerySchema,
} from "../pagination.js";
import { adminRateLimit } from "../security/rate-limit.js";

const pendingRequestsPaginationQuerySchema = getPaginationQuerySchema({
  defaultLimit: 50,
  maxLimit: 100,
});

const eventLogPaginationQuerySchema = getPaginationQuerySchema({
  defaultLimit: 100,
  maxLimit: 200,
});

const idParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const denyAccessRequestBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

function toAdminResponse(accessRequest: AccessRequest) {
  return {
    id: accessRequest.id,
    email: accessRequest.email,
    name: accessRequest.name,
    message: accessRequest.message,
    timestamp: accessRequest.timestamp.toISOString(),
  };
}

function toAdminEventResponse(event: AccessRequestEvent) {
  return {
    id: event.id,
    timestamp: event.timestamp.toISOString(),
    type: event.type,
    actorType: event.actorType,
    email: event.email,
    name: event.name,
    message: event.message,
    adminId: event.adminId,
    discardReason: event.discardReason,
    denialReason: event.denialReason,
    accessRequestId: event.accessRequestId,
  };
}

export const adminAccessRequestRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.rateLimit(adminRateLimit));
  app.addHook("preHandler", requireAdministrator);

  app.get("/admin/access-requests", async (request, reply) => {
    const parsedQuery = pendingRequestsPaginationQuerySchema.safeParse(
      request.query,
    );

    if (!parsedQuery.success) {
      return reply.code(400).send({ error: "Invalid pagination query." });
    }

    const { limit, offset } = parsedQuery.data;
    const accessRequests = await db.accessRequest.findMany({
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit + 1,
      skip: offset,
    });
    const paginatedAccessRequests = getPaginatedResponse(
      accessRequests,
      limit,
      offset,
    );

    return {
      accessRequests: paginatedAccessRequests.items.map(toAdminResponse),
      pagination: paginatedAccessRequests.pagination,
    };
  });

  app.get("/admin/access-request-events", async (request, reply) => {
    const parsedQuery = eventLogPaginationQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({ error: "Invalid pagination query." });
    }

    const { limit, offset } = parsedQuery.data;
    const events = await db.accessRequestEvent.findMany({
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit + 1,
      skip: offset,
    });
    const paginatedEvents = getPaginatedResponse(events, limit, offset);

    return {
      accessRequestEvents: paginatedEvents.items.map(toAdminEventResponse),
      pagination: paginatedEvents.pagination,
    };
  });

  app.get("/admin/access-request-events/:id", async (request, reply) => {
    const parsedParams = idParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply
        .code(400)
        .send({ error: "Invalid access request event id." });
    }

    const event = await db.accessRequestEvent.findUnique({
      where: { id: parsedParams.data.id },
    });

    if (!event) {
      return reply.code(404).send({ error: "Access request event not found." });
    }

    return toAdminEventResponse(event);
  });

  app.post("/admin/access-requests/:id/approve", async (request, reply) => {
    const parsedParams = idParamsSchema.safeParse(request.params);
    const admin = await getAuthenticatedUser(request);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid access request id." });
    }

    if (!admin) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    if (admin.role !== "ADMIN") {
      return reply.code(403).send({ error: "Administrator access required." });
    }

    const result = await db.$transaction(async (transaction) => {
      const accessRequest = await transaction.accessRequest.findUnique({
        where: { id: parsedParams.data.id },
      });

      if (!accessRequest) {
        return "ACCESS_REQUEST_NOT_FOUND" as const;
      }

      const deletion = await transaction.accessRequest.deleteMany({
        where: { id: accessRequest.id },
      });

      if (deletion.count === 0) {
        return "ACCESS_REQUEST_NOT_FOUND" as const;
      }

      const approvedAt = new Date();

      await transaction.approvedEmail.upsert({
        where: { email: accessRequest.email },
        create: {
          email: accessRequest.email,
          approvedAt,
          approvedBy: admin.id,
        },
        update: {
          approvedAt,
          approvedBy: admin.id,
        },
      });

      await transaction.accessRequestEvent.create({
        data: {
          email: accessRequest.email,
          name: accessRequest.name,
          message: accessRequest.message,
          type: "ACCESS_REQUEST_APPROVED",
          actorType: "ADMIN",
          accessRequestId: accessRequest.id,
          adminId: admin.id,
        },
      });

      return "APPROVED" as const;
    });

    if (result === "ACCESS_REQUEST_NOT_FOUND") {
      return reply.code(404).send({ error: "Access request not found." });
    }

    return reply.send({ message: "Access request approved." });
  });

  app.post("/admin/access-requests/:id/deny", async (request, reply) => {
    const parsedParams = idParamsSchema.safeParse(request.params);
    const parsedBody = denyAccessRequestBodySchema.safeParse(request.body);
    const admin = await getAuthenticatedUser(request);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid access request id." });
    }

    if (!parsedBody.success) {
      return reply.code(400).send({ error: "Invalid denial reason." });
    }

    if (!admin) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    if (admin.role !== "ADMIN") {
      return reply.code(403).send({ error: "Administrator access required." });
    }

    const result = await db.$transaction(async (transaction) => {
      const accessRequest = await transaction.accessRequest.findUnique({
        where: { id: parsedParams.data.id },
      });

      if (!accessRequest) {
        return "ACCESS_REQUEST_NOT_FOUND" as const;
      }

      const deletion = await transaction.accessRequest.deleteMany({
        where: { id: accessRequest.id },
      });

      if (deletion.count === 0) {
        return "ACCESS_REQUEST_NOT_FOUND" as const;
      }

      await transaction.accessRequestEvent.create({
        data: {
          email: accessRequest.email,
          name: accessRequest.name,
          message: accessRequest.message,
          type: "ACCESS_REQUEST_DENIED",
          actorType: "ADMIN",
          accessRequestId: accessRequest.id,
          denialReason: parsedBody.data.reason,
          adminId: admin.id,
        },
      });

      return "DENIED" as const;
    });

    if (result === "ACCESS_REQUEST_NOT_FOUND") {
      return reply.code(404).send({ error: "Access request not found." });
    }

    return reply.send({ message: "Access request denied." });
  });

  app.get("/admin/access-requests/:id", async (request, reply) => {
    const parsedParams = idParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid access request id." });
    }

    const accessRequest = await db.accessRequest.findUnique({
      where: { id: parsedParams.data.id },
    });

    if (!accessRequest) {
      return reply.code(404).send({ error: "Access request not found." });
    }

    return toAdminResponse(accessRequest);
  });
};
