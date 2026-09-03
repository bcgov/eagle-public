import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { loadConfig } from 'app/config/config';
import { ProjectActivites } from './project-activites';

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({
      project: null,
      projId: 'proj-1',
      lists: [],
      projectLoading: false,
    }),
  };
});

async function renderTab(notifyApi: string): Promise<void> {
  window.__env = { logLevel: 4, NOTIFY_API: notifyApi };
  await loadConfig();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify([{ searchResults: [], meta: [] }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );

  const router = createMemoryRouter(
    [{ path: '/p/:projId/project-activites', Component: ProjectActivites }],
    {
      initialEntries: ['/p/proj-1/project-activites'],
    },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** The subscribe control is the only route to eagle-notify from a project, and NOTIFY_API gates it. */
describe('project activities subscribe control', () => {
  const originalEnv = window.__env;

  afterEach(async () => {
    window.__env = originalEnv;
    await loadConfig();
    vi.unstubAllGlobals();
  });

  it('banners under the section heading and subscribes to this project', async () => {
    await renderTab('https://notify-api.example');

    const trigger = await screen.findByRole('button', { name: 'Subscribe' });
    const heading = screen.getByRole('heading', { name: 'Activities and Updates' });
    // The banner belongs to the heading's block, not to the table below it.
    expect(heading.parentElement).toContainElement(trigger);
    expect(heading.nextElementSibling).toBe(trigger.closest('.subscribe-popover'));
    // The form is the popover's own spec; this page owns which subscription it offers.
    expect(trigger.closest('.subscribe-popover')).toHaveAttribute('data-service', 'project:proj-1');
    expect(
      screen.getByText(/Get an email when this project publishes an Update\./),
    ).toBeInTheDocument();
  });

  it('renders no subscribe control when NOTIFY_API is empty', async () => {
    await renderTab('');

    expect(await screen.findByText('Activities and Updates')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
  });
});
