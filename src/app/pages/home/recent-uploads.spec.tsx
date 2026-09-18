import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeQueryClient, renderAt } from '../../../test-utils';
import { envelope, json, PENDING, stubFetch } from './home-fetch.spec-helper';
import { RecentUploads } from './recent-uploads';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('app/analytics/analytics', () => ({ track, page: vi.fn() }));

const LISTS = [
  { _id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { _id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
];

/** One project's feed row. Noon UTC keeps the formatted day the same either side of the date line. */
function upload(name: string, eagleProjectId: string | null, date: string, type: string) {
  return {
    projectId: `demi-${name}`,
    eagleProjectId,
    projectName: name,
    dateUploaded: `${date}T12:00:00.000Z`,
    documents: [
      { id: `d-${name}`, displayName: 'Doc', type, dateUploaded: `${date}T12:00:00.000Z` },
    ],
  };
}

const UPLOADS = [
  upload('Cedar LNG', 'eagle-1', '2026-09-01', 'type-app-2018'),
  upload('Kitimat Terminal', 'eagle-2', '2026-08-31', 'type-cert-2018'),
  // A type the List rows do not hold.
  upload('Highway 1 Widening', 'eagle-3', '2026-08-30', 'type-unknown'),
  upload('Murray River Coal', 'eagle-4', '2026-08-29', 'type-app-2018'),
  upload('Willow Creek Wind', null, '2026-08-28', 'type-app-2018'),
];

function renderUploads(
  feed: Response | typeof PENDING = json({ items: UPLOADS }),
  { retries = false }: { retries?: boolean } = {},
) {
  const requests = stubFetch((url) => {
    if (url.includes('/documents/recent-uploads')) return feed;
    if (url.includes('dataset=List')) return envelope(LISTS);
    return undefined;
  });
  renderAt(
    '/',
    [
      { path: '/', Component: RecentUploads },
      { path: '/p/:projId/documents', Component: () => <p>documents</p> },
    ],
    retries ? { queryClient: makeQueryClient({ retry: 3 }) } : {},
  );
  return requests;
}

const section = () => screen.getByRole('heading', { name: 'Recent Uploads' }).closest('section')!;

describe('home recent uploads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    track.mockClear();
  });

  it('asks the feed for five uploads', async () => {
    const requests = renderUploads();

    await screen.findByText('Cedar LNG');
    expect(requests).toContain('/demi-search/documents/recent-uploads?limit=5');
  });

  it('draws one row per project: name, destination tab and date, as one link', async () => {
    renderUploads();

    // The accessible name is the visible text, nothing more (WCAG 2.5.3).
    const row = await screen.findByRole('link', {
      name: 'Cedar LNG Application Materials Sep 1',
    });
    expect(row).toHaveAttribute('href', '/p/eagle-1/documents?sortBy=-datePosted');
    expect(within(section()).getAllByRole('listitem')).toHaveLength(5);
  });

  it('labels an unresolved document type Documents, never a dash', async () => {
    renderUploads();

    const row = await screen.findByRole('link', { name: /^Highway 1 Widening/ });
    expect(row).toHaveTextContent('Highway 1 Widening Documents Aug 30');
    expect(section()).not.toHaveTextContent('-');
  });

  it('leaves a project Eagle has no row for as text', async () => {
    renderUploads();

    await screen.findByText('Willow Creek Wind');
    expect(screen.queryByRole('link', { name: /Willow Creek Wind/ })).not.toBeInTheDocument();
  });

  it('reports a row click', async () => {
    renderUploads();

    await userEvent.setup().click(await screen.findByRole('link', { name: /^Kitimat Terminal/ }));

    expect(track).toHaveBeenLastCalledWith('Recent Upload Clicked', {
      project_id: 'eagle-2',
      project_name: 'Kitimat Terminal',
      document_id: null,
      target: 'project',
    });
  });

  it('holds a busy skeleton while the feed loads', () => {
    renderUploads(PENDING);

    expect(within(section()).getByText('Loading').closest('ul')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('keeps the heading and says so when nothing was uploaded', async () => {
    renderUploads(json({ items: [] }));

    expect(
      await screen.findByText('No documents have been uploaded recently.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Uploads' })).toBeInTheDocument();
  });

  it('keeps the heading and says the feed is unavailable, after one request', async () => {
    const requests = renderUploads(json(null, 500), { retries: true });

    expect(
      await screen.findByText('Recent uploads are unavailable right now.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Uploads' })).toBeInTheDocument();
    expect(requests.filter((url) => url.includes('/documents/recent-uploads'))).toHaveLength(1);
  });
});
