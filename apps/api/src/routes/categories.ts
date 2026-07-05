import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";

const categoryQuerySchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]).optional()
  })
  .strict();

const categoryTypeOrder = {
  EXPENSE: 0,
  INCOME: 1
} as const;

function compareCategories(
  first: { name: string; type: "INCOME" | "EXPENSE" },
  second: { name: string; type: "INCOME" | "EXPENSE" }
) {
  const typeDifference =
    categoryTypeOrder[first.type] - categoryTypeOrder[second.type];

  if (typeDifference !== 0) {
    return typeDifference;
  }

  if (first.name === "Other") {
    return second.name === "Other" ? 0 : 1;
  }

  if (second.name === "Other") {
    return -1;
  }

  return first.name.localeCompare(second.name);
}

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const parsedQuery = categoryQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({ error: "Invalid category filter." });
    }

    const categories = await db.category.findMany({
      where: {
        type: parsedQuery.data.type
      },
      select: {
        id: true,
        name: true,
        type: true
      }
    });

    return reply.send({ categories: categories.sort(compareCategories) });
  });
};
