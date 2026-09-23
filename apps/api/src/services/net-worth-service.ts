import { Prisma } from "@prisma/client";

import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";
import type { ResolvedStatisticsPeriod } from "./statistics-period.js";

type CurrentNetWorthRow = {
  startingNetWorthCents: number | null;
  currentNetWorthCents: bigint | number | null;
};

type NetWorthLedgerRow = {
  startingNetWorthCents: number | null;
  date: string | null;
  deltaCents: bigint | number;
};

type NetWorthPoint = {
  date: string;
  value: string;
};

function getNextDate(date: string) {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

function isMonthStart(date: string) {
  return date.endsWith("-01");
}

export async function getCurrentNetWorth(userId: string, today: string) {
  const [row] = await db.$queryRaw<CurrentNetWorthRow[]>(
    Prisma.sql`
      SELECT
        u."startingNetWorthCents" AS "startingNetWorthCents",
        CASE
          WHEN u."startingNetWorthCents" IS NULL
          THEN NULL
          ELSE
            u."startingNetWorthCents"::bigint
            + COALESCE(
              SUM(operation."signedAmountCents"),
              0
            )
        END AS "currentNetWorthCents"
      FROM "User" u
      LEFT JOIN "FinancialOperation" operation
        ON operation."userId" = u."id"
        AND operation."occurredOn" <= ${today}::date
      WHERE u."id" = ${userId}
      GROUP BY u."startingNetWorthCents"
    `
  );

  if (
    !row ||
    row.startingNetWorthCents === null ||
    row.currentNetWorthCents === null
  ) {
    return null;
  }

  return centsToDecimal(Number(row.currentNetWorthCents));
}

async function getNetWorthLedger(userId: string, endDate: string) {
  return db.$queryRaw<NetWorthLedgerRow[]>(
    Prisma.sql`
      SELECT
        u."startingNetWorthCents" AS "startingNetWorthCents",
        TO_CHAR(operation."occurredOn", 'YYYY-MM-DD') AS "date",
        COALESCE(
          SUM(operation."signedAmountCents"),
          0
        ) AS "deltaCents"
      FROM "User" u
      LEFT JOIN "FinancialOperation" operation
        ON operation."userId" = u."id"
        AND operation."occurredOn" <= ${endDate}::date
      WHERE u."id" = ${userId}
      GROUP BY
        u."startingNetWorthCents",
        operation."occurredOn"
      ORDER BY operation."occurredOn" ASC
    `
  );
}

export async function getNetWorthSeries(
  userId: string,
  period: ResolvedStatisticsPeriod
) {
  const ledger = await getNetWorthLedger(userId, period.endDate);
  const profile = ledger[0];

  if (!profile || profile.startingNetWorthCents === null) {
    return {
      status: "OPENING_BALANCE_REQUIRED" as const,
      points: [] as NetWorthPoint[]
    };
  }

  const deltasByDate = new Map(
    ledger.flatMap((row) =>
      row.date === null ? [] : [[row.date, Number(row.deltaCents)] as const]
    )
  );
  const visibleStart = period.from;
  let currentNetWorthCents = profile.startingNetWorthCents;

  deltasByDate.forEach((delta, date) => {
    if (date < visibleStart) {
      currentNetWorthCents += delta;
    }
  });

  const points: NetWorthPoint[] = [];

  for (
    let date = visibleStart;
    date <= period.endDate;
    date = getNextDate(date)
  ) {
    currentNetWorthCents += deltasByDate.get(date) ?? 0;

    if (
      period.mode !== "ALL" ||
      date === visibleStart ||
      isMonthStart(date) ||
      date === period.endDate
    ) {
      points.push({
        date,
        value: centsToDecimal(currentNetWorthCents)
      });
    }
  }

  return {
    status: "READY" as const,
    openingAmount: centsToDecimal(profile.startingNetWorthCents),
    points
  };
}
