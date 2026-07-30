import { QueryClient } from "@tanstack/react-query";

export const FINANCIAL_DATA_STALE_TIME_MS = 5 * 60 * 1000;
export const FINANCIAL_DATA_GC_TIME_MS = 30 * 60 * 1000;
export const TRANSACTION_DETAIL_GC_TIME_MS = 10 * 60 * 1000;
export const STATISTICS_AVAILABILITY_STALE_TIME_MS = 15 * 60 * 1000;

function getErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FINANCIAL_DATA_STALE_TIME_MS,
      gcTime: FINANCIAL_DATA_GC_TIME_MS,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry(failureCount, error) {
        const status = getErrorStatus(error);

        if (status !== null && status >= 400 && status < 500) {
          return false;
        }

        return failureCount < 1;
      }
    }
  }
});
