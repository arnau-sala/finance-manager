import Fastify from "fastify";

import { registerSecureSession } from "./auth/session.js";
import { adminAccessRequestRoutes } from "./routes/admin-access-requests.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { accessRequestRoutes } from "./routes/access-requests.js";
import { authMeRoutes } from "./routes/auth-me.js";
import { authRoutes } from "./routes/auth.js";
import { categoryRoutes } from "./routes/categories.js";
import { statisticsRoutes } from "./routes/statistics.js";
import { transactionRoutes } from "./routes/transactions.js";
import { registerRateLimit } from "./security/rate-limit.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerSecureSession(app);
  registerRateLimit(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(accessRequestRoutes);
  app.register(adminAccessRequestRoutes);
  app.register(adminUserRoutes);
  app.register(authRoutes);
  app.register(authMeRoutes);
  app.register(categoryRoutes);
  app.register(statisticsRoutes);
  app.register(transactionRoutes);

  return app;
}
