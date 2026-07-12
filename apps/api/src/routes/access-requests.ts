import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { accessRequestRateLimit } from "../security/rate-limit.js";

const GOOGLE_ACCESS_REQUEST_MESSAGE = "Requested access using Google sign-in.";
const GOOGLE_MESSAGE_SEPARATOR = "\n\n";

const accessRequestBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    name: z.string().trim().min(1).max(100),
    message: z.string().trim().max(1000).optional().default(""),
  })
  .strict();

type AccessRequestData = z.infer<typeof accessRequestBodySchema>;

function getGoogleAccessRequestMessage(message: string) {
  return message
    ? `${message}${GOOGLE_MESSAGE_SEPARATOR}${GOOGLE_ACCESS_REQUEST_MESSAGE}`
    : GOOGLE_ACCESS_REQUEST_MESSAGE;
}

const googleAccessRequestBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    message: z.string().trim().max(1000).optional().default(""),
  })
  .strict()
  .superRefine(({ message }, context) => {
    if (getGoogleAccessRequestMessage(message).length > 1000) {
      context.addIssue({
        code: "custom",
        path: ["message"],
        message: "Message must be 1,000 characters or fewer.",
      });
    }
  });

const neutralResponse = {
  message: "Access request received.",
};

async function persistAccessRequest(data: AccessRequestData) {
  try {
    await db.$transaction(async (transaction) => {
      const [user, approvedEmail, accessRequest] = await Promise.all([
        transaction.user.findUnique({
          where: { email: data.email },
          select: { id: true },
        }),
        transaction.approvedEmail.findUnique({
          where: { email: data.email },
          select: { id: true },
        }),
        transaction.accessRequest.findUnique({
          where: { email: data.email },
          select: { id: true },
        }),
      ]);

      if (user) {
        await transaction.accessRequestEvent.create({
          data: {
            ...data,
            type: "ACCESS_REQUEST_DISCARDED",
            discardReason: "EMAIL_ALREADY_REGISTERED",
            actorType: "SYSTEM",
          },
        });
        return;
      }

      if (approvedEmail || accessRequest) {
        await transaction.accessRequestEvent.create({
          data: {
            ...data,
            type: "ACCESS_REQUEST_DISCARDED",
            discardReason: "ACCESS_REQUEST_ALREADY_EXISTS",
            actorType: "SYSTEM",
          },
        });
        return;
      }

      const createdAccessRequest = await transaction.accessRequest.create({
        data,
      });

      await transaction.accessRequestEvent.create({
        data: {
          ...data,
          accessRequestId: createdAccessRequest.id,
          type: "ACCESS_REQUEST_CREATED",
          actorType: "VISITOR",
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await db.accessRequestEvent.create({
        data: {
          ...data,
          type: "ACCESS_REQUEST_DISCARDED",
          discardReason: "ACCESS_REQUEST_ALREADY_EXISTS",
          actorType: "SYSTEM",
        },
      });
      return;
    }

    throw error;
  }
}

export const accessRequestRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/access-requests",
    { config: { rateLimit: accessRequestRateLimit } },
    async (request, reply) => {
      const parsedBody = accessRequestBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid request body.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const data = parsedBody.data;

      await persistAccessRequest(data);

      return reply.code(202).send(neutralResponse);
    },
  );

  app.post(
    "/access-requests/google",
    { config: { rateLimit: accessRequestRateLimit } },
    async (request, reply) => {
      const parsedBody = googleAccessRequestBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid request body.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const email = request.session.get("googleAccessRequestEmail");
      const name = request.session.get("googleAccessRequestName");

      if (!email || !name) {
        return reply.code(400).send({
          error: "Google access request context not found.",
        });
      }

      const data = accessRequestBodySchema.parse({
        email,
        name: parsedBody.data.name,
        message: getGoogleAccessRequestMessage(parsedBody.data.message),
      });

      await persistAccessRequest(data);

      request.session.set("googleAccessRequestEmail", "");
      request.session.set("googleAccessRequestName", "");

      return reply.code(202).send(neutralResponse);
    },
  );
};
