import type { FastifyPluginAsync } from "fastify";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import {
  formatDateOnly,
  getMonthDateOnlyRange,
  getTodayDateOnly,
} from "../dates/date-only.js";
import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";
import { financialReadRateLimit } from "../security/rate-limit.js";
import {
  getUserBalance,
  getUserTransactionActivity
} from "../services/statistics-service.js";
import { getCurrentNetWorth } from "../services/net-worth-service.js";

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
            where: { userId },
            orderBy: [
              { occurredOn: "desc" },
              { createdAt: "desc" },
              { id: "desc" }
            ],
            take: latestMoveLimit,
            select: {
              id: true,
              type: true,
              amountCents: true,
              description: true,
              occurredOn: true,
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
        latestMoves: latestMoves.map((move) => ({
          id: move.id,
          type: move.type,
          category: move.category,
          amount: centsToDecimal(move.amountCents),
          description: move.description,
          date: formatDateOnly(move.occurredOn)
        })),
        activity: {
          month: period.month,
          year: period.year,
          ...activity
        }
      });
    }
  );
};
