import { QueryClient } from '@tanstack/react-query';

// 5 minutes, matching the GET response cache the Angular http-cache interceptor kept.
const FIVE_MINUTES = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      gcTime: FIVE_MINUTES,
      refetchOnWindowFocus: false
    }
  }
});
