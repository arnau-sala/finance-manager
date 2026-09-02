import type { SessionUser } from "../src/features/auth/auth-api";
import { transactionCategories } from "../src/features/transactions/category-catalog";
import type {
  TransactionDetail,
  TransactionListItem,
  TransactionsPage
} from "../src/features/transactions/transaction-api";
import type { HomeOverview } from "../src/features/home/home-api";
import type {
  StatisticsCharts,
  StatisticsOverview,
  StatisticsPeriodMode
} from "../src/features/statistics/statistics-api";

type RawTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  categoryId: string;
  amount: number;
  description: string;
  date: string;
};

type StorybookFetchMode = "anonymous" | "authenticated";

const currentDate = "2026-08-20";
const startingNetWorth = 1255.97;

export const johnSmithUser: SessionUser = {
  id: "john-smith-storybook",
  email: "john.smith@example.com",
  username: "johnsmith",
  name: "John",
  authProvider: "PASSWORD_AND_GOOGLE",
  emailLoginEnabled: true,
  role: "USER",
  status: "APPROVED",
  startingNetWorth: money(startingNetWorth),
  createdAt: "2026-07-05T09:00:00.000Z",
  updatedAt: null
};

const rawTransactions: RawTransaction[] = [
  tx("aug-mercadona", "EXPENSE", "expense-groceries", 42.65, "Mercadona", "2026-08-08"),
  tx("aug-salary", "INCOME", "income-salary", 2450, "Salary", "2026-08-03"),
  tx("aug-spotify", "EXPENSE", "expense-subscriptions", 10.99, "Spotify", "2026-08-01"),
  tx("aug-water", "EXPENSE", "expense-groceries", 1, "Water bottle", "2026-08-01"),
  tx("aug-bitcoin", "INCOME", "income-investments", 250, "Bitcoin Cash Out", "2026-08-01"),
  tx("jul-coffee", "EXPENSE", "expense-dining", 4.7, "Coffe and croissant", "2026-07-24"),
  tx("jul-chatgpt", "EXPENSE", "expense-subscriptions", 23, "ChatGPT Plus", "2026-07-23"),
  tx("jul-client-dinner", "EXPENSE", "expense-dining", 88.7, "Client dinner", "2026-07-15"),
  tx("jul-workshop", "EXPENSE", "expense-education", 120, "AI workshop", "2026-07-14"),
  tx("jul-groceries", "EXPENSE", "expense-groceries", 72.3, "Market groceries", "2026-07-12"),
  tx("jul-birthday", "EXPENSE", "expense-parties", 126.5, "Friend's birthday", "2026-07-11"),
  tx("jul-sale", "EXPENSE", "expense-shopping", 138.2, "Summer sale", "2026-07-09"),
  tx("jul-gym", "EXPENSE", "expense-sports", 45, "Gym renewal", "2026-07-08"),
  tx("jul-fuel", "EXPENSE", "expense-transport", 35.8, "Fuel and metro", "2026-07-06"),
  tx("jul-rent", "EXPENSE", "expense-housing", 850, "July rent", "2026-07-01"),
  tx("jul-salary", "INCOME", "income-salary", 2600, "Salary", "2026-07-02"),
  tx("jul-freelance", "INCOME", "income-freelance", 740, "Landing page project", "2026-07-18"),
  tx("jul-sales", "INCOME", "income-sales", 125, "Summer sale payout", "2026-07-20"),
  tx("jun-salary", "INCOME", "income-salary", 2550, "Salary", "2026-06-03"),
  tx("jun-freelance", "INCOME", "income-freelance", 840, "Automation setup", "2026-06-16"),
  tx("jun-rent", "EXPENSE", "expense-housing", 820, "June rent", "2026-06-01"),
  tx("jun-travel", "EXPENSE", "expense-transport", 210, "Train tickets", "2026-06-05"),
  tx("jun-dining", "EXPENSE", "expense-dining", 64, "Team dinner", "2026-06-12"),
  tx("jun-sports", "EXPENSE", "expense-sports", 38, "Padel court", "2026-06-22"),
  tx("may-salary", "INCOME", "income-salary", 2500, "Salary", "2026-05-04"),
  tx("may-freelance", "INCOME", "income-freelance", 650, "Analytics dashboard", "2026-05-19"),
  tx("may-gifts-income", "INCOME", "income-gifts", 250, "Birthday gift", "2026-05-24"),
  tx("may-rent", "EXPENSE", "expense-housing", 820, "May rent", "2026-05-01"),
  tx("may-shopping", "EXPENSE", "expense-shopping", 190, "New jacket", "2026-05-09"),
  tx("may-parties", "EXPENSE", "expense-parties", 94, "Concert night", "2026-05-15"),
  tx("may-groceries", "EXPENSE", "expense-groceries", 81, "Weekly groceries", "2026-05-21"),
  tx("apr-salary", "INCOME", "income-salary", 2500, "Salary", "2026-04-03"),
  tx("apr-freelance", "INCOME", "income-freelance", 520, "Website copy", "2026-04-14"),
  tx("apr-investments", "INCOME", "income-investments", 120, "Dividend payout", "2026-04-26"),
  tx("apr-rent", "EXPENSE", "expense-housing", 790, "April rent", "2026-04-01"),
  tx("apr-education", "EXPENSE", "expense-education", 110, "Design course", "2026-04-09"),
  tx("apr-dining", "EXPENSE", "expense-dining", 58, "Burgers", "2026-04-17"),
  tx("mar-salary", "INCOME", "income-salary", 2450, "Salary", "2026-03-03"),
  tx("mar-sales", "INCOME", "income-sales", 240, "Bike sale", "2026-03-20"),
  tx("mar-rent", "EXPENSE", "expense-housing", 780, "March rent", "2026-03-01"),
  tx("mar-health", "EXPENSE", "expense-health", 75, "Dentist", "2026-03-08"),
  tx("mar-gifts", "EXPENSE", "expense-gifts", 66, "Family gift", "2026-03-25"),
  tx("feb-salary", "INCOME", "income-salary", 2500, "Salary", "2026-02-03"),
  tx("feb-freelance", "INCOME", "income-freelance", 460, "Landing fixes", "2026-02-18"),
  tx("feb-rent", "EXPENSE", "expense-housing", 760, "February rent", "2026-02-01"),
  tx("feb-shopping", "EXPENSE", "expense-shopping", 155, "Winter sale", "2026-02-10"),
  tx("feb-groceries", "EXPENSE", "expense-groceries", 86, "Groceries", "2026-02-23"),
  tx("jan-salary", "INCOME", "income-salary", 2500, "Salary", "2026-01-03"),
  tx("jan-freelance", "INCOME", "income-freelance", 640, "Brand kit", "2026-01-17"),
  tx("jan-rent", "EXPENSE", "expense-housing", 740, "January rent", "2026-01-01"),
  tx("jan-groceries", "EXPENSE", "expense-groceries", 95, "Groceries", "2026-01-12"),
  tx("jan-subscription", "EXPENSE", "expense-subscriptions", 18, "Cloud storage", "2026-01-28")
];

export const johnSmithTransactions = rawTransactions
  .map(toTransactionListItem)
  .sort(compareTransactionsDescending);

function tx(
  id: string,
  type: RawTransaction["type"],
  categoryId: string,
  amount: number,
  description: string,
  date: string
): RawTransaction {
  return { id, type, categoryId, amount, description, date };
}

function money(value: number) {
  return value.toFixed(2);
}

function categoryFor(id: string) {
  const category = transactionCategories.find((candidate) => candidate.id === id);

  if (!category) {
    throw new Error(`Missing storybook category ${id}`);
  }

  return {
    id: category.id,
    name: category.name,
    type: category.type
  };
}

function toTransactionListItem(transaction: RawTransaction, index: number): TransactionListItem {
  const category = categoryFor(transaction.categoryId);

  return {
    id: transaction.id,
    type: transaction.type,
    categoryId: transaction.categoryId,
    category,
    amount: money(transaction.amount),
    description: transaction.description,
    date: transaction.date,
    createdAt: `${transaction.date}T12:${String(index % 60).padStart(2, "0")}:00.000Z`
  };
}

function compareTransactionsDescending(
  left: TransactionListItem,
  right: TransactionListItem
) {
  return (
    right.date.localeCompare(left.date) ||
    right.createdAt.localeCompare(left.createdAt)
  );
}

function compareTransactionsAscending(
  left: TransactionListItem,
  right: TransactionListItem
) {
  return (
    left.date.localeCompare(right.date) ||
    left.createdAt.localeCompare(right.createdAt)
  );
}

function signedAmount(transaction: TransactionListItem) {
  const amount = Number(transaction.amount);
  return transaction.type === "INCOME" ? amount : -amount;
}

function getPeriodBounds(mode: StatisticsPeriodMode, key: string) {
  if (mode === "MONTH") {
    const [year, month] = key.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = key === "2026-08" ? currentDate : `${key}-${String(lastDay).padStart(2, "0")}`;

    return {
      mode,
      key,
      startDate: `${key}-01`,
      endDate
    };
  }

  if (mode === "YEAR") {
    return {
      mode,
      key,
      startDate: `${key}-01-01`,
      endDate: key === "2026" ? currentDate : `${key}-12-31`
    };
  }

  return {
    mode,
    key,
    startDate: "2026-01-01",
    endDate: currentDate
  };
}

function getRequestedPeriod(url: URL) {
  const requestedPeriod = url.searchParams.get("period");

  if (requestedPeriod === "month") {
    return getPeriodBounds("MONTH", url.searchParams.get("month") ?? "2026-08");
  }

  if (requestedPeriod === "all") {
    return getPeriodBounds("ALL", "all");
  }

  return getPeriodBounds("YEAR", url.searchParams.get("year") ?? "2026");
}

function inDateRange(
  transaction: TransactionListItem,
  startDate: string,
  endDate: string
) {
  return transaction.date >= startDate && transaction.date <= endDate;
}

function filterTransactionsForPeriod(period: ReturnType<typeof getPeriodBounds>) {
  return johnSmithTransactions.filter((transaction) =>
    inDateRange(transaction, period.startDate, period.endDate)
  );
}

function getMonthEndDate(month: string, maximumDate: string) {
  if (month === maximumDate.slice(0, 7)) {
    return maximumDate;
  }

  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function getMonthKeys(startDate: string, endDate: string) {
  const [startYear = 0, startMonth = 1] = startDate
    .slice(0, 7)
    .split("-")
    .map(Number);
  const [endYear = 0, endMonth = 1] = endDate
    .slice(0, 7)
    .split("-")
    .map(Number);
  const keys: string[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return keys;
}

function getYearKeys(startDate: string, endDate: string) {
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));

  return Array.from({ length: endYear - startYear + 1 }, (_, index) =>
    String(startYear + index)
  );
}

function summarizeMoney(transactions: readonly TransactionListItem[]) {
  const income = transactions
    .filter((transaction) => transaction.type === "INCOME")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === "EXPENSE")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const balance = income - expenses;

  return {
    income,
    expenses,
    balance,
    savingsPercentage: income > 0 ? Math.round((balance / income) * 100) : null
  };
}

function summarizeCategories(transactions: readonly TransactionListItem[]) {
  const byCategory = new Map<string, TransactionListItem[]>();

  for (const transaction of transactions) {
    byCategory.set(transaction.categoryId, [
      ...(byCategory.get(transaction.categoryId) ?? []),
      transaction
    ]);
  }

  const totalByType = {
    INCOME: transactions
      .filter((transaction) => transaction.type === "INCOME")
      .reduce((total, transaction) => total + Number(transaction.amount), 0),
    EXPENSE: transactions
      .filter((transaction) => transaction.type === "EXPENSE")
      .reduce((total, transaction) => total + Number(transaction.amount), 0)
  };

  return Array.from(byCategory.entries())
    .map(([categoryId, categoryTransactions]) => {
      const amount = categoryTransactions.reduce(
        (total, transaction) => total + Number(transaction.amount),
        0
      );
      const category = categoryFor(categoryId);
      const typeTotal = totalByType[category.type];

      return {
        id: category.id,
        name: category.name,
        type: category.type,
        amount: money(amount),
        percentage: typeTotal > 0 ? Math.round((amount / typeTotal) * 100) : 0,
        transactionCount: categoryTransactions.length,
        averageAmount: money(amount / categoryTransactions.length)
      };
    })
    .sort((left, right) => Number(right.amount) - Number(left.amount));
}

function getLargestMovement(
  transactions: readonly TransactionListItem[],
  type: "INCOME" | "EXPENSE"
) {
  const largest = transactions
    .filter((transaction) => transaction.type === type)
    .sort((left, right) => Number(right.amount) - Number(left.amount))[0];

  if (!largest) {
    return null;
  }

  const { createdAt: _createdAt, ...preview } = largest;
  return preview;
}

function summarizeMonths() {
  return Array.from({ length: 8 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const key = `2026-${month}`;
    const period = getPeriodBounds("MONTH", key);
    const summary = summarizeMoney(filterTransactionsForPeriod(period));

    return {
      key,
      balance: summary.balance,
      savingsPercentage: summary.savingsPercentage ?? 0
    };
  });
}

function getOverview(url: URL): StatisticsOverview {
  const period = getRequestedPeriod(url);
  const transactions = filterTransactionsForPeriod(period);
  const moneySummary = summarizeMoney(transactions);
  const months = summarizeMonths();
  const bestMonth = [...months].sort((left, right) => right.balance - left.balance)[0];
  const worstMonth = [...months].sort((left, right) => left.balance - right.balance)[0];
  const positivePeriods = months.filter((month) => month.balance > 0).length;
  const expenseTransactions = johnSmithTransactions.filter(
    (transaction) => transaction.type === "EXPENSE"
  );
  const currentStreak = {
    days: 12,
    startDate: "2026-08-09",
    endDate: currentDate,
    lastExpenseDate: "2026-08-08"
  };

  return {
    period,
    money: {
      income: money(moneySummary.income),
      expenses: money(moneySummary.expenses),
      balance: money(moneySummary.balance),
      savingsPercentage: moneySummary.savingsPercentage
    },
    categories: summarizeCategories(transactions),
    insights: {
      largestIncome: getLargestMovement(transactions, "INCOME"),
      largestExpense: getLargestMovement(transactions, "EXPENSE"),
      bestMonth:
        period.mode === "MONTH"
          ? null
          : {
              key: bestMonth.key,
              balance: money(bestMonth.balance),
              savingsPercentage: bestMonth.savingsPercentage
            },
      worstMonth:
        period.mode === "MONTH"
          ? null
          : {
              key: worstMonth.key,
              balance: money(worstMonth.balance),
              savingsPercentage: worstMonth.savingsPercentage
            },
      bestYear: null,
      worstYear: null,
      months:
        period.mode === "MONTH"
          ? null
          : {
              positivePeriods,
              totalPeriods: months.length,
              positivePercentage: Math.round((positivePeriods / months.length) * 100),
              averageBalance: money(
                months.reduce((total, month) => total + month.balance, 0) /
                  months.length
              ),
              averageSavingsPercentage: Math.round(
                months.reduce(
                  (total, month) => total + month.savingsPercentage,
                  0
                ) / months.length
              )
            },
      years: null
    },
    expenses: {
      hasExpenseHistory: expenseTransactions.length > 0,
      transactionCount: transactions.filter((transaction) => transaction.type === "EXPENSE").length,
      typicalAmount: money(73),
      averageAmount: money(
        transactions.filter((transaction) => transaction.type === "EXPENSE")
          .reduce((total, transaction) => total + Number(transaction.amount), 0) /
          Math.max(
            1,
            period.mode === "MONTH" ? 20 : period.mode === "YEAR" ? 8 : 1
          )
      ),
      averagePeriodCount: period.mode === "MONTH" ? 20 : period.mode === "YEAR" ? 8 : 1,
      averagePeriodUnit:
        period.mode === "MONTH" ? "DAY" : period.mode === "YEAR" ? "MONTH" : "YEAR",
      currentStreak,
      longestStreak: {
        days: 12,
        startDate: "2026-08-09",
        endDate: currentDate
      },
      isLongestCurrent: true
    }
  };
}

function createFinancialInterval(key: string, startDate: string, endDate: string) {
  const summary = summarizeMoney(
    filterTransactionsForPeriod({
      mode: "ALL",
      key,
      startDate,
      endDate
    })
  );

  return {
    key,
    startDate,
    endDate,
    income: money(summary.income),
    expenses: money(summary.expenses),
    balance: money(summary.balance)
  };
}

function getFinancialIntervals(period: ReturnType<typeof getPeriodBounds>) {
  if (period.mode === "MONTH") {
    return [];
  }

  if (period.mode === "YEAR") {
    return getMonthKeys(period.startDate, period.endDate).map((month) =>
      createFinancialInterval(
        month,
        `${month}-01`,
        getMonthEndDate(month, period.endDate)
      )
    );
  }

  return getYearKeys(period.startDate, period.endDate).map((year, index, years) =>
    createFinancialInterval(
      year,
      index === 0 ? period.startDate : `${year}-01-01`,
      index === years.length - 1 ? period.endDate : `${year}-12-31`
    )
  );
}

function getNetWorthPoints(period: ReturnType<typeof getPeriodBounds>) {
  let balance = startingNetWorth;

  return johnSmithTransactions
    .slice()
    .sort(compareTransactionsAscending)
    .filter((transaction) => transaction.date <= period.endDate)
    .map((transaction) => {
      balance += signedAmount(transaction);
      return {
        date: transaction.date,
        value: balance
      };
    })
    .filter((point) => point.date >= period.startDate)
    .map((point) => ({
      date: point.date,
      value: money(point.value)
    }));
}

function getTimelineIntervals(period: ReturnType<typeof getPeriodBounds>) {
  if (period.mode === "MONTH") {
    const finalDay = Number(period.endDate.slice(-2));

    return Array.from(
      { length: Math.ceil(finalDay / 7) },
      (_, index) => {
        const weekNumber = index + 1;
        const startDay = index * 7 + 1;
        const endDay = Math.min(startDay + 6, finalDay);

        return {
          key: `${period.key}:week-${weekNumber}`,
          label: `Week ${weekNumber}`,
          startDate: `${period.key}-${String(startDay).padStart(2, "0")}`,
          endDate: `${period.key}-${String(endDay).padStart(2, "0")}`
        };
      }
    );
  }

  if (period.mode === "YEAR") {
    return getMonthKeys(period.startDate, period.endDate).map((month) => ({
      key: month,
      label: month,
      startDate: `${month}-01`,
      endDate: getMonthEndDate(month, period.endDate)
    }));
  }

  return getYearKeys(period.startDate, period.endDate).map((year, index, years) => ({
    key: year,
    label: year,
    startDate: index === 0 ? period.startDate : `${year}-01-01`,
    endDate: index === years.length - 1 ? period.endDate : `${year}-12-31`
  }));
}

function getCategoryTimeline(period: ReturnType<typeof getPeriodBounds>) {
  const intervals = getTimelineIntervals(period);
  const cells = [];

  for (const interval of intervals) {
    const transactions = filterTransactionsForPeriod({
      ...period,
      startDate: interval.startDate,
      endDate: interval.endDate
    });
    const categories = summarizeCategories(transactions);

    for (const category of categories) {
      cells.push({
        categoryId: category.id,
        type: category.type,
        intervalKey: interval.key,
        amount: category.amount,
        percentage: category.percentage,
        transactionCount: category.transactionCount
      });
    }
  }

  return { intervals, cells };
}

function getWeekdaySpending(period: ReturnType<typeof getPeriodBounds>) {
  const expenses = filterTransactionsForPeriod(period).filter(
    (transaction) => transaction.type === "EXPENSE"
  );

  return {
    hasEnoughData: expenses.length >= 7,
    values: Array.from({ length: 7 }, (_, index) => {
      const weekday = index + 1;
      const weekdayExpenses = expenses.filter((transaction) => {
        const date = new Date(`${transaction.date}T00:00:00.000Z`);
        const day = date.getUTCDay();
        return (day === 0 ? 7 : day) === weekday;
      });
      const totalAmount = weekdayExpenses.reduce(
        (total, transaction) => total + Number(transaction.amount),
        0
      );

      return {
        weekday,
        averageAmount: money(totalAmount / Math.max(1, weekdayExpenses.length)),
        totalAmount: money(totalAmount),
        transactionCount: weekdayExpenses.length
      };
    })
  };
}

function getCharts(url: URL): StatisticsCharts {
  const period = getRequestedPeriod(url);

  return {
    period,
    netWorth: {
      status: "READY",
      openingAmount: money(startingNetWorth),
      points: getNetWorthPoints(period)
    },
    financialIntervals: getFinancialIntervals(period),
    categories: summarizeCategories(filterTransactionsForPeriod(period)),
    categoryTimeline: getCategoryTimeline(period),
    weekdaySpending: getWeekdaySpending(period)
  };
}

function getHomeOverview(): HomeOverview {
  const currentMonth = getPeriodBounds("MONTH", "2026-08");
  const monthTransactions = filterTransactionsForPeriod(currentMonth);
  const allSummary = summarizeMoney(johnSmithTransactions);
  const monthCategories = summarizeCategories(monthTransactions);

  return {
    balance: {
      totalIncome: money(allSummary.income),
      totalSpent: money(allSummary.expenses),
      totalBalance: money(allSummary.balance),
      currentNetWorth: money(startingNetWorth + allSummary.balance)
    },
    latestMoves: johnSmithTransactions.slice(0, 3).map(({ createdAt: _createdAt, ...move }) => move),
    activity: {
      month: 8,
      year: 2026,
      transactionCount: monthTransactions.length,
      topExpenseCategory:
        monthCategories.find((category) => category.type === "EXPENSE") ?? null,
      topIncomeCategory:
        monthCategories.find((category) => category.type === "INCOME") ?? null
    }
  };
}

function getTransactionsPage(url: URL): TransactionsPage {
  let transactions = [...johnSmithTransactions];
  const search = url.searchParams.get("search")?.toLowerCase() ?? "";
  const type = url.searchParams.get("type");
  const categories = url.searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const exactDate = url.searchParams.get("exactDate");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const exactAmountCents = url.searchParams.get("exactAmountCents");
  const minimumAmountCents = url.searchParams.get("minimumAmountCents");
  const maximumAmountCents = url.searchParams.get("maximumAmountCents");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  if (search) {
    transactions = transactions.filter((transaction) =>
      transaction.description.toLowerCase().includes(search)
    );
  }

  if (type === "INCOME" || type === "EXPENSE") {
    transactions = transactions.filter((transaction) => transaction.type === type);
  }

  if (categories.length > 0) {
    transactions = transactions.filter((transaction) =>
      categories.includes(transaction.categoryId)
    );
  }

  if (exactDate) {
    transactions = transactions.filter((transaction) => transaction.date === exactDate);
  } else {
    if (startDate) {
      transactions = transactions.filter((transaction) => transaction.date >= startDate);
    }

    if (endDate) {
      transactions = transactions.filter((transaction) => transaction.date <= endDate);
    }
  }

  if (exactAmountCents) {
    transactions = transactions.filter(
      (transaction) => Math.round(Number(transaction.amount) * 100) === Number(exactAmountCents)
    );
  }

  if (minimumAmountCents) {
    transactions = transactions.filter(
      (transaction) => Math.round(Number(transaction.amount) * 100) >= Number(minimumAmountCents)
    );
  }

  if (maximumAmountCents) {
    transactions = transactions.filter(
      (transaction) => Math.round(Number(transaction.amount) * 100) <= Number(maximumAmountCents)
    );
  }

  const total = transactions.length;
  const pageTransactions = transactions.slice(offset, offset + limit);

  return {
    transactions: pageTransactions,
    pagination: {
      limit,
      offset,
      nextOffset: offset + limit < total ? offset + limit : null,
      total
    },
    metadata: {
      accountTransactionCount: johnSmithTransactions.length,
      minimumDate: johnSmithTransactions
        .slice()
        .sort(compareTransactionsAscending)[0]?.date ?? null
    }
  };
}

function getContext(
  transaction: TransactionListItem,
  period: ReturnType<typeof getPeriodBounds>
) {
  const periodTransactions = filterTransactionsForPeriod(period);
  const categoryTransactions = periodTransactions
    .filter((candidate) => candidate.categoryId === transaction.categoryId)
    .sort((left, right) => Number(right.amount) - Number(left.amount));
  const typeTransactions = periodTransactions
    .filter((candidate) => candidate.type === transaction.type)
    .sort((left, right) => Number(right.amount) - Number(left.amount));
  const typeTotal = typeTransactions.reduce(
    (total, candidate) => total + Number(candidate.amount),
    0
  );

  return {
    categoryRank: {
      position: categoryTransactions.findIndex((candidate) => candidate.id === transaction.id) + 1,
      total: categoryTransactions.length
    },
    typeRank: {
      position: typeTransactions.findIndex((candidate) => candidate.id === transaction.id) + 1,
      total: typeTransactions.length
    },
    periodImpactPercentage:
      typeTotal > 0 ? Math.round((Number(transaction.amount) / typeTotal) * 100) : 0
  };
}

function getTransactionDetail(transactionId: string): TransactionDetail | null {
  const transaction = johnSmithTransactions.find((candidate) => candidate.id === transactionId);

  if (!transaction) {
    return null;
  }

  let before = startingNetWorth;

  for (const candidate of johnSmithTransactions.slice().sort(compareTransactionsAscending)) {
    if (candidate.id === transaction.id) {
      break;
    }

    before += signedAmount(candidate);
  }

  const after = before + signedAmount(transaction);
  const monthPeriod = getPeriodBounds("MONTH", transaction.date.slice(0, 7));
  const yearPeriod = getPeriodBounds("YEAR", transaction.date.slice(0, 4));
  const allPeriod = getPeriodBounds("ALL", "all");

  return {
    transaction,
    trackedBalance: {
      before: money(before),
      after: money(after)
    },
    contexts: {
      month: getContext(transaction, monthPeriod),
      year: getContext(transaction, yearPeriod),
      all: getContext(transaction, allPeriod)
    }
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

function isLocalApiRequest(url: URL) {
  return url.pathname.startsWith("/api/");
}

export function installFullAppMockFetch(mode: StorybookFetchMode) {
  const originalFetch = window.fetch;

  window.fetch = async (input, init) => {
    const requestUrl = typeof input === "string" ? input : input.url;
    const url = new URL(requestUrl, window.location.origin);
    const method = init?.method?.toUpperCase() ?? "GET";

    if (!isLocalApiRequest(url)) {
      return originalFetch(input, init);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 80));

    if (url.pathname === "/api/auth/me") {
      return mode === "authenticated"
        ? jsonResponse({ user: johnSmithUser })
        : jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (url.pathname === "/api/auth/usernames/johnsmith/availability") {
      return jsonResponse({ available: true });
    }

    if (url.pathname.startsWith("/api/auth/usernames/") && url.pathname.endsWith("/availability")) {
      const username = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      return jsonResponse({
        available: !["admin", "root", "john"].includes(username)
      });
    }

    if (url.pathname === "/api/home") {
      return jsonResponse(getHomeOverview());
    }

    if (url.pathname === "/api/transactions" && method === "GET") {
      return jsonResponse(getTransactionsPage(url));
    }

    if (url.pathname.startsWith("/api/transactions/") && method === "GET") {
      const transactionId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const detail = getTransactionDetail(transactionId);
      return detail ? jsonResponse(detail) : jsonResponse({ error: "Not found" }, 404);
    }

    if (url.pathname === "/api/statistics/months") {
      return jsonResponse({
        availableMonths: [
          "2026-01",
          "2026-02",
          "2026-03",
          "2026-04",
          "2026-05",
          "2026-06",
          "2026-07",
          "2026-08"
        ],
        minimumMonth: "2026-01",
        maximumMonth: "2026-08"
      });
    }

    if (url.pathname === "/api/statistics/overview") {
      return jsonResponse({ overview: getOverview(url) });
    }

    if (url.pathname === "/api/statistics/charts") {
      return jsonResponse({ charts: getCharts(url) });
    }

    if (url.pathname === "/api/account" && method === "PATCH") {
      return jsonResponse({ user: johnSmithUser });
    }

    if (url.pathname === "/api/account/onboarding/starting-net-worth") {
      return jsonResponse({ user: johnSmithUser });
    }

    if (url.pathname === "/api/account/onboarding/starting-net-worth/skip") {
      return jsonResponse({ user: { ...johnSmithUser, startingNetWorth: null } });
    }

    if (url.pathname === "/api/account/recovery-code") {
      return jsonResponse({
        username: "johnsmith",
        recoveryCode: "9AvK-3pQx-T7mL-Z2nB",
        rotationToken: "storybook-rotation"
      });
    }

    if (url.pathname === "/api/account/username/link") {
      return jsonResponse({
        user: johnSmithUser,
        recoveryCode: "9AvK-3pQx-T7mL-Z2nB"
      });
    }

    if (url.pathname === "/api/account/username/unlink") {
      return jsonResponse({
        user: {
          ...johnSmithUser,
          username: null
        }
      });
    }

    if (url.pathname === "/api/account/email/link/verify") {
      return jsonResponse({ user: johnSmithUser });
    }

    if (url.pathname === "/api/account/email/unlink/verify") {
      return jsonResponse({
        user: {
          ...johnSmithUser,
          email: null,
          emailLoginEnabled: false
        }
      });
    }

    if (url.pathname.includes("/google/") && method === "POST") {
      return jsonResponse({ authorizationUrl: "#" });
    }

    if (url.pathname === "/api/feedback") {
      return jsonResponse({ id: "storybook-feedback" }, 201);
    }

    if (url.pathname.startsWith("/api/auth/password-reset/")) {
      if (url.pathname.endsWith("/recovery-code/verify")) {
        return jsonResponse({ username: "johnsmith" });
      }

      if (url.pathname.endsWith("/complete")) {
        return jsonResponse({
          username: "johnsmith",
          recoveryCode: "9AvK-3pQx-T7mL-Z2nB"
        });
      }

      return emptyResponse();
    }

    if (
      url.pathname.startsWith("/api/auth/register") ||
      url.pathname.startsWith("/api/account/email/") ||
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/logout" ||
      url.pathname === "/api/account/password" ||
      method === "DELETE" ||
      method === "POST" ||
      method === "PATCH"
    ) {
      return url.pathname === "/api/auth/register/username"
        ? jsonResponse({
            user: johnSmithUser,
            recoveryCode: "9AvK-3pQx-T7mL-Z2nB"
          })
        : emptyResponse();
    }

    return jsonResponse({ error: `Unhandled Storybook API mock: ${url.pathname}` }, 404);
  };

  return () => {
    window.fetch = originalFetch;
  };
}
