import type { FastifyPluginAsync } from "fastify";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import {
  formatDateOnly,
  getMonthDateOnlyRange,
  getTodayDateOnly,
} from "../dates/date-only.js";
import { db } from "../db/client.js";
import { financialReadRateLimit } from "../security/rate-limit.js";
import {
  getUserBalance,
  getUserTransactionActivity
} from "../services/statistics-service.js";
import { getCurrentNetWorth } from "../services/net-worth-service.js";
import { toTransactionResponse } from "../services/transaction-service.js";

const latestMoveLimit = 3;

function getCurrentMonthRange() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return {
    month,
    year,
    ...getMonthDateOnlyRange(month, year)
  };
}

export const homeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/home",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const period = getCurrentMonthRange();
      const today = getTodayDateOnly();
      const [balance, currentNetWorth, latestMoves, activity] =
        await Promise.all([
          getUserBalance(userId),
          getCurrentNetWorth(userId, today),
          db.transaction.findMany({
            where: { userId, groupId: null },
            orderBy: [
              { occurredOn: "desc" },
              { createdAt: "desc" },
              { id: "desc" }
            ],
            take: latestMoveLimit,
            select: {
              id: true,
              userId: true,
              type: true,
              categoryId: true,
              amountCents: true,
              currency: true,
              originalAmountMinor: true,
              exchangeRateBasePerUsd: true,
              description: true,
              occurredOn: true,
              createdAt: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  type: true
                }
              }
            }
          }),
          getUserTransactionActivity(userId, {
            from: period.from,
            to: period.to
          })
        ]);

      return reply.send({
        balance: {
          ...balance,
          currentNetWorth
        },
        latestMoves: latestMoves.map(toTransactionResponse),
        activity: {
          month: period.month,
          year: period.year,
          ...activity
        }
      });
    }
  );
};
