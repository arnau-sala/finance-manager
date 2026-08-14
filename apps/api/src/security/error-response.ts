import type { FastifyInstance } from "fastify";

function getClientErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return null;
  }

  const statusCode = error.statusCode;
  return typeof statusCode === "number" &&
    statusCode >= 400 &&
    statusCode < 500
    ? statusCode
    : null;
}

export function registerSafeErrorResponses(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const statusCode = getClientErrorStatus(error);

    if (statusCode) {
      return reply.code(statusCode).send(error);
    }

    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send({ error: "Internal server error" });
  });
}
