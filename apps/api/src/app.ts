import Fastify from "fastify";

import { accessRequestRoutes } from "./routes/access-requests.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(accessRequestRoutes);

  return app;
}
