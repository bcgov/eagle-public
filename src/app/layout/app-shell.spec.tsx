import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from 'app/routes';

describe('app shell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the header, home page and footer at /', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByText('EPIC')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Environmental Assessments' })).toBeInTheDocument();
    expect(await screen.findByText('Admin Login')).toBeInTheDocument();
  });
});
