import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { makeQueryClient, renderAt } from '../../../test-utils';
import { ACTIVITY, envelope, json, PENDING, stubFetch } from './home-fetch.spec-helper';
import { UpdatesFeed } from './updates-feed';

function renderFeed(
  feed: Response | typeof PENDING = envelope(ACTIVITY),
  { retries = false }: { retries?: boolean } = {},
) {
  const requests = stubFetch((url) => (url.includes('dataset=RecentActivity') ? feed : undefined));
  renderAt(
    '/',
    [{ path: '/', Component: UpdatesFeed }],
    // The helper turns retries off; `retries` puts back the app default, so the query's own opt-out is
    // what the spec proves.
    retries ? { queryClient: makeQueryClient({ retry: 3 }) } : {},
  );
  return requests;
}

describe('home updates feed', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the pinned-first top strip', async () => {
    const requests = renderFeed();

    await screen.findByText('Application accepted for review');
    expect(requests[0]).toContain('dataset=RecentActivity');
    expect(requests[0]).toContain('&top=true');
  });

  it('draws each update as a three-line card that opens the reader', async () => {
    renderFeed();

    const card = (await screen.findByText('Application accepted for review')).closest('a')!;
    expect(card).toHaveAttribute('href', '/updates/u1');
    expect(card).toHaveAttribute('aria-haspopup', 'dialog');
    expect(card).toHaveClass('home-update--update');
    expect(within(card).getByText('Update')).toBeInTheDocument();
    expect(within(card).getByText('Cedar LNG')).toBeInTheDocument();
    expect(within(card).getByText('September 15, 2026')).toBeInTheDocument();
  });

  it('shows updates only: comment-period activity and inactive rows stay out', async () => {
    renderFeed();

    const heading = await screen.findByRole('heading', { name: 'Updates' });
    await screen.findByText('Application accepted for review');
    const cards = within(heading.closest('section')!).getAllByRole('link', { name: /^Update/ });
    expect(cards.map((card) => card.getAttribute('href'))).toEqual(['/updates/u1', '/updates/u4']);
  });

  it('leaves the project line off an update with no project', async () => {
    renderFeed();

    const card = (await screen.findByText('Draft certificate published')).closest('a')!;
    expect(card).toHaveTextContent(/^Update September 6, 2026 Draft certificate published$/);
  });

  it('closes on the link to every activity', async () => {
    renderFeed();

    expect(screen.getByRole('link', { name: /View all Activities & Updates/ })).toHaveAttribute(
      'href',
      '/search?record=activities',
    );
  });

  it('holds a busy skeleton while the feed loads', () => {
    renderFeed(PENDING);

    expect(screen.getByText('Loading').closest('ul')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('link', { name: /^Update/ })).not.toBeInTheDocument();
  });

  it('says so when nothing has been published', async () => {
    renderFeed(envelope([]));

    expect(await screen.findByText('No updates have been published yet.')).toBeInTheDocument();
  });

  it('says the feed is unavailable, in place, after one request', async () => {
    const requests = renderFeed(json(null, 500), { retries: true });

    expect(await screen.findByText('Updates are unavailable right now.')).toBeInTheDocument();
    expect(screen.getByText('Try again in a moment.')).toBeInTheDocument();
    expect(requests.filter((url) => url.includes('dataset=RecentActivity'))).toHaveLength(1);
  });
});
