import { randomBytes } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";

import { db } from "../db/client.js";
import { authGoogleRateLimit } from "../security/rate-limit.js";

const googleCallbackQuerySchema = z
  .object({
    code: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    error: z.string().optional(),
  })
  .passthrough();

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webAppUrl: string;
};

type GoogleIdentity = {
  email: string;
  name: string;
  googleSubject: string;
};

type GoogleAccessRequestContext = {
  email: string;
  name: string;
};

type GoogleAuthResult =
  | { type: "login"; userId: string }
  | { type: "request-access"; request: GoogleAccessRequestContext };

function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      "http://localhost:5173/api/auth/google/callback",
    webAppUrl: process.env.WEB_APP_URL?.trim() || "http://localhost:5173",
  };
}

function getConfiguredWebAppUrl() {
  return process.env.WEB_APP_URL?.trim() || "http://localhost:5173";
}

function createGoogleClient(config: GoogleOAuthConfig) {
  return new OAuth2Client(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
}

function getFrontendRedirectUrl(
  config: Pick<GoogleOAuthConfig, "webAppUrl">,
  googleAuth: string,
) {
  const url = new URL(config.webAppUrl);
  url.searchParams.set("googleAuth", googleAuth);
  return url.toString();
}

function getAccessRequestContext(identity: GoogleIdentity) {
  return {
    email: identity.email,
    name: identity.name,
  };
}

async function handleGoogleIdentity(
  identity: GoogleIdentity,
): Promise<GoogleAuthResult> {
  const requestContext = getAccessRequestContext(identity);

  return db.$transaction(async (transaction) => {
    const [userByGoogleSubject, userByEmail] = await Promise.all([
      transaction.user.findUnique({
        where: { googleSubject: identity.googleSubject },
        select: {
          id: true,
          authProvider: true,
          googleSubject: true,
          status: true,
        },
      }),
      transaction.user.findUnique({
        where: { email: identity.email },
        select: {
          id: true,
          authProvider: true,
          googleSubject: true,
          status: true,
        },
      }),
    ]);

    const existingUser = userByGoogleSubject ?? userByEmail;

    if (existingUser) {
      if (
        existingUser.authProvider === "GOOGLE" &&
        existingUser.googleSubject === identity.googleSubject &&
        existingUser.status === "APPROVED"
      ) {
        return { type: "login", userId: existingUser.id };
      }

      return { type: "request-access", request: requestContext };
    }

    const approvedEmail = await transaction.approvedEmail.findUnique({
      where: { email: identity.email },
      select: { id: true, usedAt: true },
    });

    if (!approvedEmail || approvedEmail.usedAt) {
      return { type: "request-access", request: requestContext };
    }

    const approvalClaim = await transaction.approvedEmail.updateMany({
      where: {
        id: approvedEmail.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    if (approvalClaim.count !== 1) {
      return { type: "request-access", request: requestContext };
    }

    const user = await transaction.user.create({
      data: {
        email: identity.email,
        passwordHash: null,
        authProvider: "GOOGLE",
        googleSubject: identity.googleSubject,
        role: "USER",
        status: "APPROVED",
        updatedAt: null,
      },
      select: { id: true },
    });

    return { type: "login", userId: user.id };
  });
}

export const authGoogleRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/auth/google/start",
    { config: { rateLimit: authGoogleRateLimit } },
    async (request, reply) => {
      const config = getGoogleOAuthConfig();

      if (!config) {
        return reply.redirect(
          getFrontendRedirectUrl(
            { webAppUrl: getConfiguredWebAppUrl() },
            "not-configured",
          ),
        );
      }

      const state = randomBytes(32).toString("hex");
      const client = createGoogleClient(config);

      request.session.set("userId", "");
      request.session.set("googleAccessRequestEmail", "");
      request.session.set("googleAccessRequestName", "");
      request.session.set("googleOAuthState", state);

      return reply.redirect(
        client.generateAuthUrl({
          scope: ["openid", "email", "profile"],
          state,
          prompt: "select_account",
        }),
      );
    },
  );

  app.get(
    "/auth/google/callback",
    { config: { rateLimit: authGoogleRateLimit } },
    async (request, reply) => {
      const config = getGoogleOAuthConfig();

      if (!config) {
        return reply.redirect(
          getFrontendRedirectUrl(
            { webAppUrl: getConfiguredWebAppUrl() },
            "not-configured",
          ),
        );
      }

      const parsedQuery = googleCallbackQuerySchema.safeParse(request.query);
      const failureRedirectUrl = getFrontendRedirectUrl(config, "failed");

      if (!parsedQuery.success) {
        return reply.redirect(failureRedirectUrl);
      }

      const expectedState = request.session.get("googleOAuthState");
      request.session.set("googleOAuthState", "");

      if (parsedQuery.data.error) {
        return reply.redirect(getFrontendRedirectUrl(config, "cancelled"));
      }

      if (
        !parsedQuery.data.code ||
        !parsedQuery.data.state ||
        !expectedState ||
        parsedQuery.data.state !== expectedState
      ) {
        return reply.redirect(failureRedirectUrl);
      }

      const client = createGoogleClient(config);
      const { tokens } = await client.getToken(parsedQuery.data.code);

      if (!tokens.id_token) {
        return reply.redirect(failureRedirectUrl);
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.clientId,
      });
      const payload = ticket.getPayload();
      const email = payload?.email?.trim().toLowerCase();
      const name = payload?.name?.trim() || email?.split("@")[0] || "Google user";

      if (!payload?.sub || !email || payload.email_verified !== true) {
        return reply.redirect(failureRedirectUrl);
      }

      const result = await handleGoogleIdentity({
        email,
        name,
        googleSubject: payload.sub,
      });

      if (result.type === "login") {
        request.session.regenerate();
        request.session.set("userId", result.userId);
        return reply.redirect(getFrontendRedirectUrl(config, "login-success"));
      }

      request.session.set("userId", "");
      request.session.set("googleAccessRequestEmail", result.request.email);
      request.session.set("googleAccessRequestName", result.request.name);

      return reply.redirect(getFrontendRedirectUrl(config, "request-access"));
    },
  );

  app.get(
    "/auth/google/request-context",
    { config: { rateLimit: authGoogleRateLimit } },
    async (request, reply) => {
      const email = request.session.get("googleAccessRequestEmail");
      const name = request.session.get("googleAccessRequestName");

      if (!email || !name) {
        return reply.code(404).send({ error: "Google request context not found." });
      }

      return reply.send({
        request: {
          email,
          name,
          message: "",
        },
      });
    },
  );
};
