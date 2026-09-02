import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { loadConfig } from 'app/config/config';
import { ProjectActivites } from './project-activites';

vi.mock('./project-context', async importOriginal => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({ project: null, projId: 'proj-1', lists: [], projectLoading: false })
  };
});

async function renderTab(env: Record<string, unknown>): Promise<void> {
  window.__env = { logLevel: 4, ...env };
  await loadConfig();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify([{ searchResults: [], meta: [] }]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )
  );

  const router = createMemoryRouter([{ path: '/p/:projId/project-activites', Component: ProjectActivites }], {
    initialEntries: ['/p/proj-1/project-activites']
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

/** The subscribe link is the only route to eagle-notify from a project, and NOTIFY_URL gates it. */
describe('project activities subscribe link', () => {
  const original = window.__env;

  afterEach(async () => {
    window.__env = original;
    await loadConfig();
    vi.unstubAllGlobals();
  });

  it('subscribes to this project when NOTIFY_URL is set', async () => {
    await renderTab({ NOTIFY_URL: 'https://notify.example/' });

    // The link shape is config.spec's; this page owns which service it subscribes to.
    expect(await screen.findByRole('link', { name: 'Subscribe to updates' })).toHaveAttribute(
      'href',
      expect.stringContaining('?s=project:proj-1')
    );
  });

  it('renders no subscribe link when NOTIFY_URL is empty', async () => {
    await renderTab({ NOTIFY_URL: '' });

    expect(await screen.findByText('Activities and Updates')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Subscribe to updates' })).toBeNull();
  });
});
