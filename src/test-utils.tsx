import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryRouter,
  type InitialEntry,
  type RouteObject,
} from 'react-router';
import { vi } from 'vitest';

type QueryDefaults = NonNullable<NonNullable<QueryClientConfig['defaultOptions']>['queries']>;

/** Retries and caching off, so a spec sees only the requests its own render triggered. */
export function makeQueryClient(queries?: QueryDefaults): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, ...queries } } });
}

/** An empty search envelope, the shape `fetchData` and `rowsFrom` read. */
export function emptySearchEnvelope(): Response {
  return new Response(JSON.stringify([{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }]), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Runs `issue` with fetch stubbed to an empty envelope and gives back the URL it asked for. */
export async function capturedRequestUrl(issue: () => Promise<unknown>): Promise<string> {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => emptySearchEnvelope());
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
