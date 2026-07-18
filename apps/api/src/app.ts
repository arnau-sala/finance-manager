import Fastify from "fastify";

import { registerSecureSession } from "./auth/session.js";
import { accountRoutes } from "./routes/account.js";
import { adminAccessRequestRoutes } from "./routes/admin-access-requests.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { accessRequestRoutes } from "./routes/access-requests.js";
import { authGoogleRoutes } from "./routes/auth-google.js";
import { authMeRoutes } from "./routes/auth-me.js";
import { authRoutes } from "./routes/auth.js";
import { categoryRoutes } from "./routes/categories.js";
import { homeRoutes } from "./routes/home.js";
import { statisticsRoutes } from "./routes/statistics.js";
import { transactionRoutes } from "./routes/transactions.js";
import { registerOriginCheck } from "./security/origin-check.js";
import { registerRateLimit } from "./security/rate-limit.js";
import { registerSecurityHeaders } from "./security/security-headers.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerSecurityHeaders(app);
  registerSecureSession(app);
  registerOriginCheck(app);
  registerRateLimit(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(accessRequestRoutes);
  app.register(accountRoutes);
  app.register(adminAccessRequestRoutes);
  app.register(adminUserRoutes);
  app.register(authGoogleRoutes);
  app.register(authRoutes);
  app.register(authMeRoutes);
  app.register(categoryRoutes);
  app.register(homeRoutes);
  app.register(statisticsRoutes);
  app.register(transactionRoutes);

  return app;
}
