import Fastify from "fastify";

import { adminAccessRequestRoutes } from "./routes/admin-access-requests.js";
import { accessRequestRoutes } from "./routes/access-requests.js";
import { authRoutes } from "./routes/auth.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(accessRequestRoutes);
  app.register(adminAccessRequestRoutes);
  app.register(authRoutes);

  return app;
}
