import type { InfiniteData } from "@tanstack/react-query";

import type { TransactionsPage } from "../features/transactions/transaction-api";
import { financialQueryKeys } from "./financial-query-keys";
import { prefetchScheduler } from "./prefetch-scheduler";
import { queryClient } from "./query-client";

function keepFirstTransactionPage(userId: string) {
  queryClient.setQueriesData<InfiniteData<TransactionsPage>>(
    { queryKey: financialQueryKeys.transactionLists(userId) },
    (data) => {
      if (!data || data.pages.length <= 1) {
        return data;
      }

      return {
        pages: data.pages.slice(0, 1),
        pageParams: data.pageParams.slice(0, 1)
      };
    }
  );
}

export async function invalidateAfterTransactionWrite(userId: string) {
  prefetchScheduler.clear();
  keepFirstTransactionPage(userId);

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: financialQueryKeys.home(userId)
    }),
    queryClient.invalidateQueries({
      queryKey: financialQueryKeys.transactionLists(userId)
    }),
    queryClient.invalidateQueries({
      queryKey: financialQueryKeys.transactionDetails(userId)
    }),
    queryClient.invalidateQueries({
      queryKey: financialQueryKeys.statistics(userId)
    })
  ]);
}

export async function invalidateAfterStartingNetWorthWrite(
  userId: string
) {
  prefetchScheduler.clear();

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: financialQueryKeys.home(userId)
    }),
    queryClient.invalidateQueries({
      queryKey: financialQueryKeys.statistics(userId)
    })
  ]);
}

export function clearAuthenticatedData() {
  prefetchScheduler.clear();
  queryClient.clear();
}
