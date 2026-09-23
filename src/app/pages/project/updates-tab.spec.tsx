import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadConfig } from 'app/config/config';
import { renderAt } from '../../../test-utils';
import { UpdatesTab } from './updates-tab';

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

const UPDATES: Record<string, unknown>[] = [
  {
    _id: 'act-2',
    headline: 'Draft report published',
    content: '<p>Read the draft assessment report.</p>',
    dateAdded: '2026-01-09T00:00:00.000Z',
    type: 'News',
  },
  {
    _id: 'act-1',
    headline: 'Application accepted for review',
    content: '<p>The application moves to the next stage.</p><p>Caribou studies follow.</p>',
    dateAdded: '2026-03-04T00:00:00.000Z',
    type: 'News',
  },
];

let requests: string[] = [];
let rows: Record<string, unknown>[] = UPDATES;

async function renderTab(notifyApi: string, searchResults = UPDATES, path = '/p/proj-1/updates') {
  window.__env = { logLevel: 4, NOTIFY_API: notifyApi };
  await loadConfig();
  requests = [];
  rows = searchResults;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (input: RequestInfo | URL) =>
        requests.push(String(input)) &&
        new Response(
          JSON.stringify([{ searchResults: rows, meta: [{ searchResultsTotal: rows.length }] }]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    ),
  );

  return renderAt(path, [
    { path: '/p/:projId/updates', Component: UpdatesTab },
    { path: '/p/:projId/overview', element: <p>overview tab</p> },
  ]);
}

const headlines = () =>
  screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

describe('updates tab', () => {
  const originalEnv = window.__env;

  afterEach(async () => {
    window.__env = originalEnv;
    await loadConfig();
    vi.unstubAllGlobals();
  });

  it('heads the tab with how many updates the project has, from one project read', async () => {
    await renderTab('https://notify-api.example');

    expect(await screen.findByRole('heading', { level: 2, name: 'Updates' })).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('2 updates, newest first');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('dataset=RecentActivity');
    expect(requests[0]).toContain('and[project]=proj-1');
  });

  it('lists updates newest first by publish date, falling back to the date added', async () => {
    await renderTab('https://notify-api.example', [
      ...UPDATES,
      {
        _id: 'act-3',
        headline: 'Scheduled late, added early',
        dateAdded: '2025-12-01T00:00:00.000Z',
        status: 'published',
        publishDate: '2026-02-01T00:00:00.000Z',
      },
    ]);

    await screen.findByText('Application accepted for review');
    expect(headlines()).toEqual([
      'Application accepted for review',
      'Scheduled late, added early',
      'Draft report published',
    ]);
    expect(screen.getByText('March 4, 2026 · News')).toBeInTheDocument();
  });

  it('leaves out drafts and archived updates', async () => {
    await renderTab('https://notify-api.example', [
      ...UPDATES,
      { _id: 'd', headline: 'A draft', status: 'draft' },
      { _id: 'a', headline: 'An archived one', status: 'archived' },
    ]);

    await screen.findByText('Application accepted for review');
    expect(headlines()).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('2 updates, newest first');
  });

  it('filters the loaded list once typing pauses, without another request', async () => {
    const { router } = await renderTab('https://notify-api.example');
    await screen.findByText('Application accepted for review');

    await userEvent.setup().type(screen.getByLabelText('Filter updates'), 'caribou');

    // The box holds every keystroke at once; the count is announced once, after the pause.
    expect(screen.getByLabelText('Filter updates')).toHaveValue('caribou');
    expect(screen.getByRole('status')).toHaveTextContent('2 updates, newest first');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('1 of 2 updates match'),
    );
    expect(headlines()).toEqual(['Application accepted for review']);
    expect(router.state.location.search).toContain('keywordsActivities=caribou');
    expect(requests).toHaveLength(1);
  });

  it('puts the filter box back in step when the URL changes under it', async () => {
    const { router } = await renderTab(
      'https://notify-api.example',
      UPDATES,
      '/p/proj-1/updates?keywordsActivities=caribou',
    );
    expect(await screen.findByLabelText('Filter updates')).toHaveValue('caribou');

    await act(() => router.navigate('/p/proj-1/updates?keywordsActivities=report'));

    expect(screen.getByLabelText('Filter updates')).toHaveValue('report');
  });

  it('shows the last page when the page in the URL is past the end', async () => {
    await renderTab(
      'https://notify-api.example',
      UPDATES,
      '/p/proj-1/updates?currentPageActivities=9',
    );

    expect(await screen.findByText('Application accepted for review')).toBeInTheDocument();
  });

  it('says so in place of the list when the read fails, rather than loading forever', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    const { container } = renderAt('/p/proj-1/updates', [
      { path: '/p/:projId/updates', element: <UpdatesTab /> },
    ]);

    expect(
      await screen.findByText('Updates could not be loaded right now. Try again in a moment.'),
    ).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('says when nothing matches the filter', async () => {
    await renderTab(
      'https://notify-api.example',
      UPDATES,
      '/p/proj-1/updates?keywordsActivities=zzz',
    );

    expect(await screen.findByText('No updates match that filter.')).toBeInTheDocument();
  });

  it('opens a summary to the full update in place', async () => {
    await renderTab('https://notify-api.example');
    await screen.findByText('Application accepted for review');
    expect(screen.queryByText('Caribou studies follow.')).not.toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /Read full update: Application accepted/ }));

    expect(screen.getByText('Caribou studies follow.')).toBeInTheDocument();
  });

  it('sends the reader to the overview when the project has no visible update', async () => {
    const { router } = await renderTab('https://notify-api.example', [
      { _id: 'd', headline: 'A draft', status: 'draft' },
    ]);

    expect(await screen.findByText('overview tab')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/p/proj-1/overview');
  });

  it('sends the reader to the overview when the count drops to zero on a refetch', async () => {
    const { router, queryClient } = await renderTab('https://notify-api.example');
    await screen.findByText('Application accepted for review');

    rows = [];
    await act(() => queryClient.invalidateQueries({ queryKey: ['projectUpdates'] }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/overview'));
  });

  it('offers this project subscription from the aside, wired to the popover', async () => {
    await renderTab('https://notify-api.example');

    const card = (await screen.findByRole('heading', { name: 'Never miss an update' }))
      .parentElement!;
    const trigger = screen.getByRole('button', { name: 'Subscribe to this project' });
    expect(card).toContainElement(trigger);
    expect(trigger.closest('.subscribe-popover')).toHaveAttribute('data-service', 'project:proj-1');

    // The trigger's target is the popover the reader gets; the panel's own spec covers its form.
    const panel = document.getElementById(trigger.getAttribute('popovertarget') ?? '');
    expect(panel).toHaveAttribute('popover', 'auto');
    expect(panel).toHaveAttribute('role', 'dialog');
  });

  it('renders no subscribe card when NOTIFY_API is empty', async () => {
    await renderTab('');

    expect(await screen.findByRole('heading', { level: 2, name: 'Updates' })).toBeInTheDocument();
    expect(screen.queryByText('Never miss an update')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
  });

  it('marks the list busy while the project read is in flight, and says nothing about emptiness', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { container } = renderAt('/p/proj-1/updates', [
      { path: '/p/:projId/updates', element: <UpdatesTab /> },
    ]);

    expect(container.querySelector('.updates-tab__list[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('No updates match that filter.')).not.toBeInTheDocument();
  });
});
