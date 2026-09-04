import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
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

const UPDATES = [
  {
    _id: 'act-1',
    headline: 'Application accepted for review',
    content: '<p>The application moves to the next stage.</p>',
    dateAdded: '2026-03-04T00:00:00.000Z',
    type: 'News',
  },
  {
    _id: 'act-2',
    headline: 'Draft report published',
    content: '<p>Read the draft assessment report.</p>',
    dateAdded: '2026-01-09T00:00:00.000Z',
    type: 'News',
  },
];

async function renderTab(notifyApi: string, searchResults = UPDATES): Promise<void> {
  window.__env = { logLevel: 4, NOTIFY_API: notifyApi };
  await loadConfig();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([{ searchResults, meta: [{ searchResultsTotal: searchResults.length }] }]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ),
  );

  renderAt('/p/proj-1/updates', [{ path: '/p/:projId/updates', Component: UpdatesTab }]);
}

describe('updates tab', () => {
  const originalEnv = window.__env;

  afterEach(async () => {
    window.__env = originalEnv;
    await loadConfig();
    vi.unstubAllGlobals();
  });

  it('heads the tab with how many updates the query found', async () => {
    await renderTab('https://notify-api.example');

    expect(await screen.findByRole('heading', { level: 2, name: 'Updates' })).toBeInTheDocument();
    expect(await screen.findByText('2 updates, newest first')).toBeInTheDocument();
  });

  it('renders a card per update returned by the query', async () => {
    await renderTab('https://notify-api.example');

    expect(await screen.findByText('Application accepted for review')).toBeInTheDocument();
    expect(screen.getByText('Draft report published')).toBeInTheDocument();
    expect(screen.getByText('March 4, 2026')).toBeInTheDocument();
  });

  it('says so when the project has published nothing, and counts nothing', async () => {
    await renderTab('https://notify-api.example', []);

    expect(
      await screen.findByText('No updates have been published for this project.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/newest first/)).toBeNull();
  });

  it('offers this project subscription from the aside, wired to the popover', async () => {
    await renderTab('https://notify-api.example');

    const card = (await screen.findByRole('heading', { name: 'Never miss an update' }))
      .parentElement!;
    const trigger = screen.getByRole('button', { name: 'Subscribe' });
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
});
