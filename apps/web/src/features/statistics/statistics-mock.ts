export type MockStatisticsTransaction = {
  id: string;
  date: string;
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  amountCents?: number;
};

export type MockStatisticsMonthlyTotal = {
  month: string;
  income: number;
  expenses: number;
};

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function createMockTransactions(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
) {
  const transactions: MockStatisticsTransaction[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthIndex = year * 12 + month;
    const monthKey = getMonthKey(year, month);
    const transactionCount = 5 + ((monthIndex * 11 + 7) % 26);
    const daysInMonth = getDaysInMonth(year, month);

    for (
      let transactionIndex = 0;
      transactionIndex < transactionCount;
      transactionIndex += 1
    ) {
      const day =
        1 + ((transactionIndex * 7 + monthIndex * 3) % daysInMonth);

      transactions.push({
        id: `mock-transaction-${monthKey}-${transactionIndex + 1}`,
        date: `${monthKey}-${String(day).padStart(2, "0")}`
      });
    }

    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }

  return transactions;
}

const today = new Date();
const todayKey = getLocalDateKey(today);
const currentMonthKey = getMonthKey(
  today.getFullYear(),
  today.getMonth() + 1
);

export const mockStatisticsMonthlyTotals = [
  { month: "2024-03", income: 2450, expenses: 2610 },
  { month: "2024-04", income: 2250, expenses: 2425 },
  { month: "2024-05", income: 2600, expenses: 1850 },
  { month: "2024-06", income: 2300, expenses: 2500 },
  { month: "2024-07", income: 2800, expenses: 2000 },
  { month: "2024-08", income: 2100, expenses: 2240 },
  { month: "2024-09", income: 2400, expenses: 2550 },
  { month: "2024-10", income: 2500, expenses: 2675 },
  { month: "2024-11", income: 2250, expenses: 1500 },
  { month: "2024-12", income: 2400.5, expenses: 1480.25 },
  { month: "2025-01", income: 3500, expenses: 2200 },
  { month: "2025-02", income: 3500, expenses: 2100 },
  { month: "2025-03", income: 3650, expenses: 2400 },
  { month: "2025-04", income: 3500, expenses: 2250 },
  { month: "2025-05", income: 3900, expenses: 2550 },
  { month: "2025-06", income: 3650, expenses: 4000 },
  { month: "2025-07", income: 4100, expenses: 2600 },
  { month: "2025-08", income: 3400, expenses: 2000 },
  { month: "2025-09", income: 3700, expenses: 2300 },
  { month: "2025-10", income: 3900, expenses: 2500 },
  { month: "2025-11", income: 3600, expenses: 1800 },
  { month: "2025-12", income: 4100.2, expenses: 2425.85 },
  { month: "2026-01", income: 3250, expenses: 2450.8 },
  { month: "2026-02", income: 0, expenses: 482.65 },
  { month: "2026-03", income: 4250, expenses: 1987.45 },
  { month: "2026-04", income: 2350, expenses: 2784.2 },
  { month: "2026-05", income: 5175.4, expenses: 2240.75 },
  { month: "2026-06", income: 2890, expenses: 2455.85 },
  { month: "2026-07", income: 3325.75, expenses: 1918.3 }
].filter(
  ({ month }) => month <= currentMonthKey
) satisfies MockStatisticsMonthlyTotal[];

export const mockStatisticsTransactions = [
  ...createMockTransactions(
    2024,
    3,
    today.getFullYear(),
    today.getMonth() + 1
  ),
  {
    id: "mock-transaction-expense-gifts-2026-04-12",
    date: "2026-04-12",
    type: "EXPENSE" as const,
    categoryId: "expense-gifts",
    amountCents: 10000
  }
].filter(
  (transaction) => transaction.date <= todayKey
) satisfies MockStatisticsTransaction[];

const transactionCountsByMonth = mockStatisticsTransactions.reduce(
  (counts, transaction) => {
    const month = transaction.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
    return counts;
  },
  new Map<string, number>()
);

export const mockTransactionMonths = [...transactionCountsByMonth].map(
  ([month, transactionCount]) => ({ month, transactionCount })
);

export const mockStatisticsMonthAvailability = {
  availableMonths: mockTransactionMonths.map(({ month }) => month),
  minimumMonth: mockTransactionMonths[0].month,
  maximumMonth: mockTransactionMonths[mockTransactionMonths.length - 1].month
} as const;

const availableYears = [
  ...new Set(
    mockTransactionMonths.map(({ month }) => Number(month.slice(0, 4)))
  )
];

export const mockStatisticsYearAvailability = {
  availableYears,
  minimumYear: availableYears[0] ?? null,
  maximumYear: today.getFullYear()
} as const;
