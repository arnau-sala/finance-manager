import {
  mockStatisticsMonthlyTotals,
  mockStatisticsTransactions
} from "../statistics-mock";

export type MockDailyFinancialSnapshot = {
  date: string;
  incomeCents: number;
  expenseCents: number;
  netWorthCents: number;
};

type WeightedDay = {
  day: number;
  weight: number;
};

export const mockOpeningNetWorth = {
  date: "2024-03-01",
  amountCents: 647_300
} as const;

function getDaysInMonth(monthKey: string) {
  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getLastAvailableDay(monthKey: string) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return monthKey === todayKey.slice(0, 7)
    ? Number(todayKey.slice(-2))
    : getDaysInMonth(monthKey);
}

function distributeCents(totalCents: number, weightedDays: readonly WeightedDay[]) {
  const allocations = new Map<number, number>();

  if (totalCents <= 0 || weightedDays.length === 0) {
    return allocations;
  }

  const totalWeight = weightedDays.reduce(
    (total, event) => total + event.weight,
    0
  );
  let distributedCents = 0;

  weightedDays.forEach((event, index) => {
    const isLastEvent = index === weightedDays.length - 1;
    const amountCents = isLastEvent
      ? totalCents - distributedCents
      : Math.round((totalCents * event.weight) / totalWeight);

    allocations.set(
      event.day,
      (allocations.get(event.day) ?? 0) + amountCents
    );
    distributedCents += amountCents;
  });

  return allocations;
}

function createIncomeDays(monthKey: string, lastDay: number) {
  const monthSeed = Number(monthKey.replace("-", ""));
  const candidateDays = [2, 8 + (monthSeed % 3), 15, 23 + (monthSeed % 4)];
  const weights =
    monthSeed % 2 === 0 ? [68, 12, 13, 7] : [63, 9, 18, 10];

  return candidateDays.map((day, index) => ({
    day: Math.min(Math.max(day, 2), lastDay),
    weight: weights[index] ?? 1
  }));
}

function createExpenseDays(monthKey: string, lastDay: number) {
  const sourceDates = mockStatisticsTransactions.filter(
    (transaction) =>
      transaction.date.startsWith(monthKey) && transaction.type !== "INCOME"
  );
  const monthSeed = Number(monthKey.replace("-", ""));
  const weightedDays: WeightedDay[] = [
    {
      day: Math.min(3, lastDay),
      weight: 36 + (monthSeed % 9)
    }
  ];

  sourceDates.forEach((transaction, index) => {
    const sourceDay = Number(transaction.date.slice(-2));
    weightedDays.push({
      day: Math.min(Math.max(sourceDay, 2), lastDay),
      weight: 2 + ((sourceDay * 5 + index * 3 + monthSeed) % 10)
    });
  });

  return weightedDays;
}

function createMockDailyFinancialSnapshots() {
  const snapshots: MockDailyFinancialSnapshot[] = [];
  let netWorthCents = mockOpeningNetWorth.amountCents;

  mockStatisticsMonthlyTotals.forEach((monthlyTotal) => {
    const lastDay = getLastAvailableDay(monthlyTotal.month);
    const incomeByDay = distributeCents(
      Math.round(monthlyTotal.income * 100),
      createIncomeDays(monthlyTotal.month, lastDay)
    );
    const expensesByDay = distributeCents(
      Math.round(monthlyTotal.expenses * 100),
      createExpenseDays(monthlyTotal.month, lastDay)
    );

    for (let day = 1; day <= lastDay; day += 1) {
      const incomeCents = incomeByDay.get(day) ?? 0;
      const expenseCents = expensesByDay.get(day) ?? 0;
      netWorthCents += incomeCents - expenseCents;

      snapshots.push({
        date: `${monthlyTotal.month}-${String(day).padStart(2, "0")}`,
        incomeCents,
        expenseCents,
        netWorthCents
      });
    }
  });

  return snapshots;
}

export const mockDailyFinancialSnapshots =
  createMockDailyFinancialSnapshots();
