import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router';

type QueryDefaults = NonNullable<NonNullable<QueryClientConfig['defaultOptions']>['queries']>;

/** Retries and caching off, so a spec sees only the requests its own render triggered. */
export function makeQueryClient(queries?: QueryDefaults): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, ...queries } } });
}

/** Renders `routes` at `path` inside the providers the app mounts in main.tsx. */
export function renderAt(
  path: string,
  routes: RouteObject[],
  {
    queryClient = makeQueryClient(),
    ...options
  }: RenderOptions & { queryClient?: QueryClient } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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
