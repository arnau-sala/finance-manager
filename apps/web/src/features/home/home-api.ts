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

export async function getHomeOverview(signal?: AbortSignal) {
  const response = await fetch("/api/home", {
    method: "GET",
    credentials: "include",
    signal
  });

  if (!response.ok) {
    throw new Error("Unable to load your overview.");
  }

  return (await response.json()) as HomeOverview;
}
