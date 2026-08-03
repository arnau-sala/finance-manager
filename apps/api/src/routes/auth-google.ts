import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";

import { deleteUserAccount } from "../account/delete-account.js";
import { supportsGoogleAuthentication } from "../auth/auth-provider.js";
import { db } from "../db/client.js";
import {
  accountDeletionRateLimit,
  accountLinkRateLimit,
  authGoogleRateLimit,
} from "../security/rate-limit.js";

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

type GoogleAuthResult =
  | { type: "login"; userId: string; sessionVersion: number }
  | { type: "password-required" }
  | { type: "failed" };

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

async function getVerifiedGoogleIdentity(
  client: OAuth2Client,
  code: string,
  clientId: string,
): Promise<GoogleIdentity | null> {
  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    return null;
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  const email = payload?.email?.trim().toLowerCase();
  const name = (
    payload?.name?.trim() ||
    email?.split("@")[0] ||
    "Google user"
  ).slice(0, 100);

  if (!payload?.sub || !email || payload.email_verified !== true) {
    return null;
  }

  return {
    email,
    name,
    googleSubject: payload.sub,
  };
}

function getFrontendRedirectUrl(
  config: Pick<GoogleOAuthConfig, "webAppUrl">,
  googleAuth: string,
) {
  const url = new URL(config.webAppUrl);
  url.searchParams.set("googleAuth", googleAuth);
  return url.toString();
}

function getAccountDeletionRedirectUrl(
  config: Pick<GoogleOAuthConfig, "webAppUrl">,
  result: string,
) {
  const url = new URL(config.webAppUrl);
  url.searchParams.set("accountDeletion", result);
  return url.toString();
}

function getAccountLinkRedirectUrl(
  config: Pick<GoogleOAuthConfig, "webAppUrl">,
  result: string,
) {
  const url = new URL(config.webAppUrl);
  url.searchParams.set("accountLink", result);
  return url.toString();
}

async function handleGoogleIdentity(
  identity: GoogleIdentity,
): Promise<GoogleAuthResult> {
  try {
    return await db.$transaction(async (transaction) => {
      const [userByGoogleSubject, userByEmail] = await Promise.all([
        transaction.user.findUnique({
          where: { googleSubject: identity.googleSubject },
          select: {
            id: true,
            authProvider: true,
            googleSubject: true,
            status: true,
            sessionVersion: true,
          },
        }),
        transaction.user.findUnique({
          where: { email: identity.email },
          select: {
            id: true,
            authProvider: true,
            googleSubject: true,
            status: true,
            sessionVersion: true,
          },
        }),
      ]);

      if (userByGoogleSubject) {
        if (
          supportsGoogleAuthentication(userByGoogleSubject.authProvider) &&
          userByGoogleSubject.status === "APPROVED"
        ) {
          return {
            type: "login",
            userId: userByGoogleSubject.id,
            sessionVersion: userByGoogleSubject.sessionVersion,
          };
        }

        return { type: "failed" };
      }

      if (userByEmail) {
        if (
          supportsGoogleAuthentication(userByEmail.authProvider) &&
          userByEmail.googleSubject === identity.googleSubject &&
          userByEmail.status === "APPROVED"
        ) {
          return {
            type: "login",
            userId: userByEmail.id,
            sessionVersion: userByEmail.sessionVersion,
          };
        }

        return userByEmail.authProvider === "PASSWORD"
          ? { type: "password-required" }
          : { type: "failed" };
      }

      await transaction.pendingRegistration.deleteMany({
        where: { email: identity.email },
      });

      const user = await transaction.user.create({
        data: {
          email: identity.email,
          name: identity.name,
          passwordHash: null,
          authProvider: "GOOGLE",
          googleSubject: identity.googleSubject,
          role: "USER",
          status: "APPROVED",
          emailVerifiedAt: new Date(),
          updatedAt: null,
        },
        select: { id: true, sessionVersion: true },
      });

      return {
        type: "login",
        userId: user.id,
        sessionVersion: user.sessionVersion,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { type: "failed" };
    }

    throw error;
  }
}

type GoogleAccountLinkResult = "success" | "mismatch" | "failed";

async function linkGoogleIdentityToUser(
  identity: GoogleIdentity,
  userId: string,
  sessionVersion: number,
): Promise<GoogleAccountLinkResult> {
  return db.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId, sessionVersion },
      select: {
        id: true,
        email: true,
        authProvider: true,
        passwordHash: true,
        googleSubject: true,
        status: true,
      },
    });

    if (!user || user.status !== "APPROVED") {
      return "failed";
    }

    if (user.email !== identity.email) {
      return "mismatch";
    }

    if (
      user.authProvider !== "PASSWORD" ||
      !user.passwordHash ||
      user.googleSubject
    ) {
      return "failed";
    }

    const existingGoogleAccount = await transaction.user.findUnique({
      where: { googleSubject: identity.googleSubject },
      select: { id: true },
    });

    if (existingGoogleAccount && existingGoogleAccount.id !== user.id) {
      return "failed";
    }

    const update = await transaction.user.updateMany({
      where: {
        id: user.id,
        sessionVersion,
        status: "APPROVED",
        authProvider: "PASSWORD",
        googleSubject: null,
      },
      data: {
        authProvider: "PASSWORD_AND_GOOGLE",
        googleSubject: identity.googleSubject,
      },
    });

    return update.count === 1 ? "success" : "failed";
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
      request.session.set("sessionVersion", 0);
      request.session.set("googleAccountDeletionState", "");
      request.session.set("googleAccountLinkState", "");
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

  app.post(
    "/account/google/delete/start",
    { config: { rateLimit: accountDeletionRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const config = getGoogleOAuthConfig();

      if (!config) {
        return reply.code(503).send({
          error: "Google sign-in is not configured.",
        });
      }

      const user = await db.user.findUnique({
        where: { id: userId, sessionVersion },
        select: { authProvider: true, googleSubject: true },
      });

      if (!user) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (
        !supportsGoogleAuthentication(user.authProvider) ||
        !user.googleSubject
      ) {
        return reply.code(400).send({
          error: "Google reauthentication is unavailable for this account.",
        });
      }

      const state = randomBytes(32).toString("hex");
      const client = createGoogleClient(config);

      request.session.set("googleOAuthState", "");
      request.session.set("googleAccountLinkState", "");
      request.session.set("googleAccountDeletionState", state);

      return reply.send({
        authorizationUrl: client.generateAuthUrl({
          scope: ["openid", "email", "profile"],
          state,
          prompt: "select_account",
        }),
      });
    },
  );

  app.post(
    "/account/google/link/start",
    { config: { rateLimit: accountLinkRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const config = getGoogleOAuthConfig();

      if (!config) {
        return reply.code(503).send({
          error: "Google sign-in is not configured.",
        });
      }

      const user = await db.user.findUnique({
        where: { id: userId, sessionVersion },
        select: {
          authProvider: true,
          passwordHash: true,
          googleSubject: true,
          status: true,
        },
      });

      if (!user || user.status !== "APPROVED") {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (
        user.authProvider !== "PASSWORD" ||
        !user.passwordHash ||
        user.googleSubject
      ) {
        return reply.code(409).send({
          error: "Google linking is unavailable for this account.",
        });
      }

      const state = randomBytes(32).toString("hex");
      const client = createGoogleClient(config);

      request.session.set("googleOAuthState", "");
      request.session.set("googleAccountDeletionState", "");
      request.session.set("googleAccountLinkState", state);

      return reply.send({
        authorizationUrl: client.generateAuthUrl({
          scope: ["openid", "email", "profile"],
          state,
          prompt: "select_account",
        }),
      });
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
      const deletionFailureUrl = getAccountDeletionRedirectUrl(config, "failed");
      const linkFailureUrl = getAccountLinkRedirectUrl(config, "failed");
      const expectedDeletionState = request.session.get(
        "googleAccountDeletionState",
      );
      const expectedLinkState = request.session.get("googleAccountLinkState");

      if (!parsedQuery.success) {
        if (expectedDeletionState) {
          request.session.set("googleAccountDeletionState", "");
          return reply.redirect(deletionFailureUrl);
        }

        if (expectedLinkState) {
          request.session.set("googleAccountLinkState", "");
          return reply.redirect(linkFailureUrl);
        }

        return reply.redirect(failureRedirectUrl);
      }

      const expectedState = request.session.get("googleOAuthState");

      if (parsedQuery.data.error) {
        if (expectedDeletionState) {
          request.session.set("googleAccountDeletionState", "");
          return reply.redirect(
            getAccountDeletionRedirectUrl(config, "cancelled"),
          );
        }

        if (expectedLinkState) {
          request.session.set("googleAccountLinkState", "");
          return reply.redirect(
            getAccountLinkRedirectUrl(config, "cancelled"),
          );
        }

        request.session.set("googleOAuthState", "");
        return reply.redirect(getFrontendRedirectUrl(config, "cancelled"));
      }

      if (expectedDeletionState) {
        request.session.set("googleAccountDeletionState", "");

        if (
          !parsedQuery.data.code ||
          !parsedQuery.data.state ||
          parsedQuery.data.state !== expectedDeletionState
        ) {
          return reply.redirect(deletionFailureUrl);
        }

        try {
          const client = createGoogleClient(config);
          const identity = await getVerifiedGoogleIdentity(
            client,
            parsedQuery.data.code,
            config.clientId,
          );
          const activeUserId = request.session.get("userId");
          const activeSessionVersion = request.session.get("sessionVersion");

          if (
            !identity ||
            !activeUserId ||
            activeSessionVersion === undefined
          ) {
            return reply.redirect(deletionFailureUrl);
          }

          const accountDeleted = await db.$transaction(async (transaction) => {
            const user = await transaction.user.findUnique({
              where: {
                id: activeUserId,
                sessionVersion: activeSessionVersion,
              },
              select: {
                id: true,
                email: true,
                authProvider: true,
                googleSubject: true,
              },
            });

            if (
              !user ||
              !supportsGoogleAuthentication(user.authProvider) ||
              user.googleSubject !== identity.googleSubject ||
              user.email !== identity.email
            ) {
              return false;
            }

            return deleteUserAccount(transaction, user);
          });

          if (!accountDeleted) {
            return reply.redirect(
              getAccountDeletionRedirectUrl(config, "mismatch"),
            );
          }

          request.session.delete();
          return reply.redirect(
            getAccountDeletionRedirectUrl(config, "success"),
          );
        } catch {
          return reply.redirect(deletionFailureUrl);
        }
      }

      if (expectedLinkState) {
        request.session.set("googleAccountLinkState", "");

        if (
          !parsedQuery.data.code ||
          !parsedQuery.data.state ||
          parsedQuery.data.state !== expectedLinkState
        ) {
          return reply.redirect(linkFailureUrl);
        }

        try {
          const client = createGoogleClient(config);
          const identity = await getVerifiedGoogleIdentity(
            client,
            parsedQuery.data.code,
            config.clientId,
          );
          const activeUserId = request.session.get("userId");
          const activeSessionVersion = request.session.get("sessionVersion");

          if (
            !identity ||
            !activeUserId ||
            activeSessionVersion === undefined
          ) {
            return reply.redirect(linkFailureUrl);
          }

          const result = await linkGoogleIdentityToUser(
            identity,
            activeUserId,
            activeSessionVersion,
          );

          return reply.redirect(getAccountLinkRedirectUrl(config, result));
        } catch {
          return reply.redirect(linkFailureUrl);
        }
      }

      request.session.set("googleOAuthState", "");

      if (
        !parsedQuery.data.code ||
        !parsedQuery.data.state ||
        !expectedState ||
        parsedQuery.data.state !== expectedState
      ) {
        return reply.redirect(failureRedirectUrl);
      }

      const client = createGoogleClient(config);
      const identity = await getVerifiedGoogleIdentity(
        client,
        parsedQuery.data.code,
        config.clientId,
      );

      if (!identity) {
        return reply.redirect(failureRedirectUrl);
      }

      const result = await handleGoogleIdentity(identity);

      if (result.type === "login") {
        request.session.regenerate();
        request.session.set("userId", result.userId);
        request.session.set("sessionVersion", result.sessionVersion);
        return reply.redirect(getFrontendRedirectUrl(config, "login-success"));
      }

      return reply.redirect(
        getFrontendRedirectUrl(
          config,
          result.type === "password-required" ? "password-required" : "failed",
        ),
      );
    },
  );
};
