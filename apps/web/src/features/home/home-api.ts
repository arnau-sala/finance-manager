export type HomeMove = {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: {
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE";
  };
  amount: string;
  description: string;
  date: string;
};

export type HomeOverview = {
  balance: {
    totalIncome: string;
    totalSpent: string;
    totalBalance: string;
  };
  latestMoves: HomeMove[];
  activity: {
    month: number;
    year: number;
    transactionCount: number;
    topExpenseCategory: { id: string; name: string } | null;
    topIncomeCategory: { id: string; name: string } | null;
  };
};

export class HomeApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HomeApiError";
    this.status = status;
  }
}

export async function getHomeOverview(signal?: AbortSignal) {
  const response = await fetch("/api/home", {
    method: "GET",
    credentials: "include",
    signal
  });

  if (!response.ok) {
    throw new HomeApiError("Unable to load your overview.", response.status);
  }

  return (await response.json()) as HomeOverview;
}
