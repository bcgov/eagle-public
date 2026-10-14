import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryRouter,
  type InitialEntry,
  type RouteObject,
} from 'react-router';
import { vi } from 'vitest';
import { native } from 'app/pages/home/home-fetch.spec-helper';

type QueryDefaults = NonNullable<NonNullable<QueryClientConfig['defaultOptions']>['queries']>;

/**
 * Retries and caching off, so a spec sees only the requests its own render triggered. A query
 * that sets its own `retry` retries at once rather than after the 1 s default delay.
 */
export function makeQueryClient(queries?: QueryDefaults): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0, ...queries } },
  });
}

/** Runs `issue` with fetch stubbed to an empty native read and gives back the URL it asked for. */
export async function capturedRequestUrl(issue: () => Promise<unknown>): Promise<string> {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => native([]));
  vi.stubGlobal('fetch', fetchMock);
  try {
    await issue();
    return String(fetchMock.mock.calls[0]?.[0] ?? '');
  } finally {
    vi.unstubAllGlobals();
  }
}

/**
 * Renders `routes` at `at`, a path or a history stack opened at `initialIndex`, inside the
 * providers the app mounts in main.tsx.
 */
export function renderAt(
  at: string | InitialEntry[],
  routes: RouteObject[],
  {
    queryClient = makeQueryClient(),
    initialIndex,
    ...options
  }: RenderOptions & { queryClient?: QueryClient; initialIndex?: number } = {},
) {
  const initialEntries = typeof at === 'string' ? [at] : at;
  const router = createMemoryRouter(routes, { initialEntries, initialIndex });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
      options,
    ),
    router,
    queryClient,
  };
}
