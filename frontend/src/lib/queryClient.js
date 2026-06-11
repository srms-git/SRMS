import { QueryClient } from "@tanstack/react-query"

/** How long cached menu data stays fresh before a background refetch. */
export const SRMS_STALE_TIME_MS = 5 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: SRMS_STALE_TIME_MS,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
