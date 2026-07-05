import type { AccessRequest, AccessRequestEvent } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { requireAdministrator } from "../auth/require-administrator.js";
import { db } from "../db/client.js";

const idParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const denyAccessRequestBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1000)
  })
  .strict();

function toAdminResponse(accessRequest: AccessRequest) {
  return {
    id: accessRequest.id,
    email: accessRequest.email,
    name: accessRequest.name,
    message: accessRequest.message,
    timestamp: accessRequest.timestamp.toISOString()
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
    accessRequestId: event.accessRequestId
  };
}

export const adminAccessRequestRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdministrator);

  app.get("/admin/access-requests", async () => {
    const accessRequests = await db.accessRequest.findMany({
      orderBy: { timestamp: "desc" }
    });

    return {
      accessRequests: accessRequests.map(toAdminResponse)
    };
  });

  app.get("/admin/access-request-events", async () => {
    const events = await db.accessRequestEvent.findMany({
      orderBy: { timestamp: "desc" }
    });

    return {
      accessRequestEvents: events.map(toAdminEventResponse)
    };
  });

  app.get("/admin/access-request-events/:id", async (request, reply) => {
    const parsedParams = idParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid access request event id." });
    }

    const event = await db.accessRequestEvent.findUnique({
      where: { id: parsedParams.data.id }
    });

    if (!event) {
      return reply.code(404).send({ error: "Access request event not found." });
    }

    return toAdminEventResponse(event);
  });

  app.post("/admin/access-requests/:id/approve", async (request, reply) => {
    const parsedParams = idParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid access request id." });
    }

    const result = await db.$transaction(async (transaction) => {
      const accessRequest = await transaction.accessRequest.findUnique({
        where: { id: parsedParams.data.id }
      });

      if (!accessRequest) {
        return "ACCESS_REQUEST_NOT_FOUND" as const;
      }

      const deletion = await transaction.accessRequest.deleteMany({
        where: { id: accessRequest.id }
      });

      if (deletion.count === 0) {
        return "ACCESS_REQUEST_NOT_FOUND" as const;
      }

      const approvedAt = new Date();

      await transaction.approvedEmail.upsert({
        where: { email: accessRequest.email },
        create: {
          email: accessRequest.email,
          approvedAt
        },
        update: {
          approvedAt
        }
      });

      await transaction.accessRequestEvent.create({
        data: {
          email: accessRequest.email,
          name: accessRequest.name,
          message: accessRequest.message,
          type: "ACCESS_REQUEST_APPROVED",
          actorType: "ADMIN",
          accessRequestId: accessRequest.id
        }
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

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid access request id." });
    }

    if (!parsedBody.success) {
      return reply.code(400).send({ error: "Invalid denial reason." });
    }

    const result = await db.$transaction(async (transaction) => {
      const accessRequest = await transaction.accessRequest.findUnique({
        where: { id: parsedParams.data.id }
      });

      if (!accessRequest) {
        return "ACCESS_REQUEST_NOT_FOUND" as const;
      }

      const deletion = await transaction.accessRequest.deleteMany({
        where: { id: accessRequest.id }
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
          denialReason: parsedBody.data.reason
        }
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
      where: { id: parsedParams.data.id }
    });

    if (!accessRequest) {
      return reply.code(404).send({ error: "Access request not found." });
    }

    return toAdminResponse(accessRequest);
  });
};
