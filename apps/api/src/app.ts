import formBody from "@fastify/formbody";
import Fastify, { type FastifyRequest } from "fastify";

import { registerSecureSession } from "./auth/session.js";
import { accountEmailRoutes } from "./routes/account-email.js";
import { accountRoutes } from "./routes/account.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { authGoogleRoutes } from "./routes/auth-google.js";
import { authMeRoutes } from "./routes/auth-me.js";
import { authRoutes } from "./routes/auth.js";
import { passwordRecoveryRoutes } from "./routes/password-recovery.js";
import { categoryRoutes } from "./routes/categories.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { homeRoutes } from "./routes/home.js";
import { statisticsRoutes } from "./routes/statistics.js";
import { transactionRoutes } from "./routes/transactions.js";
import { registerApiErrorMonitoring } from "./observability/sentry.js";
import { registerOriginCheck } from "./security/origin-check.js";
import { registerRateLimit } from "./security/rate-limit.js";
import { registerSafeErrorResponses } from "./security/error-response.js";
import { registerSecurityHeaders } from "./security/security-headers.js";

function serializeRequestForLogs(request: FastifyRequest) {
  return {
    method: request.method,
    url: request.url.split(/[?#]/, 1)[0],
    host: request.headers.host,
    remoteAddress: request.ip,
  };
}

export function buildApp() {
  const app = Fastify({
    trustProxy: process.env.VERCEL === "1",
    logger: {
      serializers: {
        req: serializeRequestForLogs,
      },
    },
  });

  app.register(formBody);
  registerSecurityHeaders(app);
  registerSecureSession(app);
  registerOriginCheck(app);
  registerRateLimit(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/", async () => {
    return {
      name: "Finance Manager API",
      status: "ok",
      health: "/health",
    };
  });

  app.register(accountRoutes);
  app.register(accountEmailRoutes);
  app.register(adminUserRoutes);
  app.register(authGoogleRoutes);
  app.register(authRoutes);
  app.register(passwordRecoveryRoutes);
  app.register(authMeRoutes);
  app.register(categoryRoutes);
  app.register(feedbackRoutes);
  app.register(homeRoutes);
  app.register(statisticsRoutes);
  app.register(transactionRoutes);
  registerSafeErrorResponses(app);
  registerApiErrorMonitoring(app);

  return app;
}
