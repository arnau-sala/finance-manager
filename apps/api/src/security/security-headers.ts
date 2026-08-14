import helmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";

export function registerSecurityHeaders(app: FastifyInstance) {
  app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: {
      policy: "no-referrer",
    },
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "private, no-store");
    return payload;
  });
}
