import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../test-utils';
import { loadConfig } from 'app/config/config';
import { News } from './news';

const ACTIVITIES = [
  {
    _id: 'a1',
    headline: 'Permit granted',
    dateAdded: '2026-08-20T00:00:00.000Z',
    content: '<p>Body</p>',
  },
  {
    _id: 'a2',
    headline: 'Comment period opens',
    dateAdded: '2026-08-18T00:00:00.000Z',
    content: '<p>Body</p>',
  },
];

let requests: string[];

function renderNews(path: string, total = 42) {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(
        JSON.stringify([{ searchResults: ACTIVITIES, meta: [{ searchResultsTotal: total }] }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );

  return renderAt(path, [{ path: '/news', Component: News }]).router;
}

describe('news', () => {
  beforeEach(() => {
    requests = [];
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requests RecentActivity sorted by dateAdded, not the shared datePosted default', async () => {
    renderNews('/news');

    expect(await screen.findByText('Permit granted')).toBeInTheDocument();
    expect(requests.at(-1)).toBe(
      '/api/search?dataset=RecentActivity&pageNum=0&pageSize=10&projectLegislation=default&sortBy=-dateAdded&sortBy=&populate=true&fuzzy=false',
    );
  });

  it('reads currentPage and pageSize off the URL', async () => {
    renderNews('/news?currentPage=2&pageSize=25');

    await screen.findByText('Permit granted');
    expect(requests.at(-1)).toContain('&pageNum=1&pageSize=25&');
  });

  it('writes currentPage on a page change', async () => {
    const router = renderNews('/news');
    await screen.findByText('Permit granted');

    await userEvent.click(screen.getAllByRole('button', { name: 'Go to page 3' })[0]);

    await waitFor(() => expect(router.state.location.search).toContain('currentPage=3'));
    await waitFor(() => expect(requests.at(-1)).toContain('&pageNum=2&'));
  });

  it('sorts the Date column descending first, then flips', async () => {
    const router = renderNews('/news');
    await screen.findByText('Permit granted');

    const dateHeader = () =>
      within(screen.getByRole('columnheader', { name: 'Date' })).getByRole('button');

    await userEvent.click(dateHeader());
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBe('+dateAdded'),
    );

    await userEvent.click(dateHeader());
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBe('-dateAdded'),
    );
  });

  it('does not sort the Headline column', async () => {
    const router = renderNews('/news');
    await screen.findByText('Permit granted');

    const headline = screen.getByRole('columnheader', { name: 'Headline' });
    expect(headline.querySelector('button')).toBeNull();
    await userEvent.click(headline);

    expect(router.state.location.search).toBe('');
  });

  it('puts a keyword search in the URL and the request, back on page 1', async () => {
    const router = renderNews('/news?currentPage=4');
    await screen.findByText('Permit granted');

    await userEvent.type(screen.getByPlaceholderText('Type keyword to search'), 'permit');
    await userEvent.click(screen.getByRole('button', { name: /Search/ }));

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('keywords')).toBe('permit');
      expect(params.get('currentPage')).toBe('1');
    });
    await waitFor(() => expect(requests.at(-1)).toContain('&keywords=permit&'));
  });

  it('shows the empty state instead of the table when nothing matches', async () => {
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

    renderAt('/news', [{ path: '/news', Component: News }]);

    expect(await screen.findByText('No activities found')).toBeInTheDocument();
  });
});

/** The subscribe control is the only route to eagle-notify from this page, and NOTIFY_API gates it. */
describe('news subscribe control', () => {
  const originalEnv = window.__env;

  afterEach(async () => {
    window.__env = originalEnv;
    await loadConfig();
    vi.unstubAllGlobals();
  });

  async function configure(notifyApi: string): Promise<void> {
    window.__env = { logLevel: 4, NOTIFY_API: notifyApi };
    await loadConfig();
  }

  it('offers the all-updates subscription when NOTIFY_API is set', async () => {
    await configure('https://notify-api.example');
    renderNews('/news');

    const trigger = await screen.findByRole('button', { name: 'Subscribe' });
    // The form is the popover's own spec; this page owns which subscription it offers.
    expect(trigger.closest('.subscribe-popover')).toHaveAttribute('data-service', 'eao:updates');
    // The band sits in its own padded wrapper under the hero.
    expect(document.querySelector('.container.pb-3 > .subscribe-popover')).not.toBeNull();
    expect(
      screen.getByText(/Get an email when any project publishes an Update\./),
    ).toBeInTheDocument();
  });

  it('renders no subscribe control when NOTIFY_API is empty', async () => {
    await configure('');
    renderNews('/news');

    await screen.findByText('Permit granted');
    expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
    expect(document.querySelector('.subscribe-popover')).toBeNull();
    // The guard drops the wrapper too, so no empty padding is left under the hero.
    expect(document.querySelector('.container.pb-3')).toBeNull();
  });

  it('offers no advanced filters or Search Help link', async () => {
    renderNews('/news');

    await screen.findByText('Permit granted');
    expect(screen.queryByRole('link', { name: /search help/i })).toBeNull();
  });
});
