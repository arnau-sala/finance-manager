import type { FastifyPluginAsync } from "fastify";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

export const statisticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/statistics/balance", async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const totals = await db.transaction.groupBy({
      by: ["type"],
      where: { userId },
      _sum: {
        amountCents: true
      }
    });

    const totalIncomeCents =
      totals.find((total) => total.type === "INCOME")?._sum.amountCents ?? 0;
    const totalSpentCents =
      totals.find((total) => total.type === "EXPENSE")?._sum.amountCents ?? 0;
    const totalBalanceCents = totalIncomeCents - totalSpentCents;

    return reply.send({
      balance: {
        totalIncome: centsToDecimal(totalIncomeCents),
        totalSpent: centsToDecimal(totalSpentCents),
        totalBalance: centsToDecimal(totalBalanceCents)
      }
    });
  });
};
