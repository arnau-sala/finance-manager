import secureSession from "@fastify/secure-session";
import type { FastifyInstance } from "fastify";

const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

declare module "@fastify/secure-session" {
  interface SessionData {
    userId: string;
    sessionVersion: number;
    googleOAuthState: string;
    googleAccountDeletionState: string;
    googleAccountLinkState: string;
    googleAccessRequestEmail: string;
    googleAccessRequestName: string;
  }
}

export function registerSecureSession(app: FastifyInstance) {
  const sessionKey = process.env.SESSION_KEY;

  if (!sessionKey || !/^[a-f\d]{64}$/i.test(sessionKey)) {
    throw new Error("SESSION_KEY must be a 64-character hexadecimal value.");
  }

  app.register(secureSession, {
    key: Buffer.from(sessionKey, "hex"),
    cookieName: "finance_manager_session",
    expiry: SESSION_DURATION_SECONDS,
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DURATION_SECONDS
    }
  });
}
