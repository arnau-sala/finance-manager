export type MockStatisticsTransaction = {
  id: string;
  date: string;
};

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
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

export const mockStatisticsTransactions = createMockTransactions(
  2024,
  3,
  2027,
  7
);

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
