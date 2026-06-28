import type { AccessRequest, AccessRequestEvent } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";

const idParamsSchema = z.object({
  id: z.string().trim().min(1)
});

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
    createdAt: event.createdAt.toISOString(),
    type: event.type,
    actorType: event.actorType,
    accessRequestId: event.accessRequestId,
    email: event.email,
    name: event.name,
    message: event.message,
    discardReason: event.discardReason,
  };
}

export const adminAccessRequestRoutes: FastifyPluginAsync = async (app) => {
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
      orderBy: { createdAt: "desc" }
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
