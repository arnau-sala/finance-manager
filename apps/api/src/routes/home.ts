import type { FastifyPluginAsync } from "fastify";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";
import { financialReadRateLimit } from "../security/rate-limit.js";
import {
  getUserBalance,
  getUserTransactionActivity
} from "../services/statistics-service.js";

const latestMoveLimit = 3;

function getCurrentMonthRange() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1)
  };
}

export const homeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/home",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const period = getCurrentMonthRange();
      const [balance, latestMoves, activity] = await Promise.all([
        getUserBalance(userId),
        db.transaction.findMany({
          where: { userId },
          orderBy: [
            { occurredAt: "desc" },
            { createdAt: "desc" },
            { id: "desc" }
          ],
          take: latestMoveLimit,
          select: {
            id: true,
            type: true,
            amountCents: true,
            description: true,
            occurredAt: true,
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
        balance,
        latestMoves: latestMoves.map((move) => ({
          id: move.id,
          type: move.type,
          category: move.category,
          amount: centsToDecimal(move.amountCents),
          description: move.description,
          date: move.occurredAt.toISOString()
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
