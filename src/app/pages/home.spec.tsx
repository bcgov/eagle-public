import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeQueryClient, renderAt } from '../../test-utils';
import { Home } from './home';

const { track, openDocumentDownload } = vi.hoisted(() => ({
  track: vi.fn(),
  openDocumentDownload: vi.fn(),
}));
vi.mock('app/analytics/analytics', () => ({ track, page: vi.fn() }));
vi.mock('app/utils/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/utils/utils')>()),
  openDocumentDownload,
}));

const LISTS = [
  { _id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { _id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
  { _id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { _id: 'type-letter-2018', name: 'Letter', legislation: 2018, type: 'doctype' },
];

/** Noon UTC keeps the formatted day the same either side of the date line. */
const UPLOADS = [
  {
    projectId: 'demi-1',
    eagleProjectId: 'eagle-1',
    projectName: 'Cedar LNG',
    dateUploaded: '2026-09-01T12:00:00.000Z',
    documents: [
      {
        id: 'd1',
        eagleId: 'e1',
        displayName: 'Application part 1',
        documentFileName: 'application-part-1.pdf',
        type: 'type-app-2018',
        dateUploaded: '2026-09-01T12:00:00.000Z',
      },
      {
        id: 'd1b',
        eagleId: 'e1b',
        displayName: 'Certificate decision letter',
        documentFileName: 'certificate-decision-letter.pdf',
        type: 'type-cert-2018',
        dateUploaded: '2026-08-27T12:00:00.000Z',
      },
      {
        id: 'd1c',
        eagleId: 'e1c',
        displayName: 'Covering letter',
        // Null covers the fallback: no file name lands on the API record.
        documentFileName: null,
        type: 'type-letter-2018',
        dateUploaded: '2026-08-26T12:00:00.000Z',
      },
    ],
  },
  {
    projectId: 'demi-2',
    eagleProjectId: 'eagle-2',
    projectName: 'Kitimat Terminal',
    dateUploaded: '2026-08-31T12:00:00.000Z',
    documents: [
      {
        id: 'd2',
        eagleId: 'e2',
        displayName: 'Certificate',
        documentFileName: 'certificate.pdf',
        type: 'type-cert-2018',
        dateUploaded: '2026-08-31T12:00:00.000Z',
      },
    ],
  },
  {
    projectId: 'demi-3',
    eagleProjectId: 'eagle-3',
    projectName: 'Highway 1 Widening',
    dateUploaded: '2026-08-30T12:00:00.000Z',
    documents: [
      {
        id: 'd3',
        eagleId: 'e3',
        displayName: 'Amendment package',
        documentFileName: 'amendment-package.pdf',
        type: 'type-amend-2002',
        dateUploaded: '2026-08-30T12:00:00.000Z',
      },
    ],
  },
  {
    projectId: 'demi-4',
    eagleProjectId: 'eagle-4',
    projectName: 'Murray River Coal',
    dateUploaded: '2026-08-29T12:00:00.000Z',
    documents: [
      {
        id: 'd4',
        eagleId: 'e4',
        displayName: 'Inspection record',
        documentFileName: 'inspection-record.pdf',
        type: 'type-letter-2018',
        dateUploaded: '2026-08-29T12:00:00.000Z',
      },
    ],
  },
  {
    projectId: 'demi-5',
    eagleProjectId: null,
    projectName: 'Willow Creek Wind',
    dateUploaded: '2026-08-28T12:00:00.000Z',
    documents: [
      {
        id: 'd5',
        eagleId: 'e5',
        displayName: 'Correspondence',
        documentFileName: 'correspondence.pdf',
        type: 'type-letter-2018',
        dateUploaded: '2026-08-28T12:00:00.000Z',
      },
    ],
  },
];

let requests: string[] = [];

function renderHome({
  items = UPLOADS,
  uploadsStatus = 200,
  retries = false,
}: { items?: unknown[]; uploadsStatus?: number; retries?: boolean } = {}) {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('/documents/recent-uploads')) {
        if (uploadsStatus !== 200) {
          return new Response('', { status: uploadsStatus, statusText: 'Server Error' });
        }
        return new Response(JSON.stringify({ items }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('dataset=List')) {
        return new Response(JSON.stringify([{ searchResults: LISTS, meta: [] }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([{ searchResults: [], meta: [] }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );

  return renderAt(
    '/',
    [
      { path: '/', Component: Home },
      // Where the feed's links point, so a click under test navigates instead of failing the route.
      { path: '/p/:projId/documents/*', Component: () => <p>documents</p> },
    ],
    // The spec helper turns retries off for every query; `retries` puts back the app client's
    // default of 3, so a query that has to opt out itself cannot pass on the helper's setting.
    retries ? { queryClient: makeQueryClient({ retry: 3 }) } : {},
  );
}

/** The Recent Uploads section, once its feed has rendered. */
async function uploadsSection(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: 'Recent Uploads' });
  await within(heading.parentElement!).findByRole('heading', { name: 'Cedar LNG' });
  return heading.parentElement as HTMLElement;
}

/** The project blocks in render order. Each project heading sits in the list item that is its row. */
async function rows(): Promise<HTMLElement[]> {
  const section = await uploadsSection();
  return within(section)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => {
      const row = heading.closest('li');
      if (!row) throw new Error(`no row around ${heading.textContent}`);
      return row as HTMLElement;
    });
}

async function rowFor(name: string): Promise<HTMLElement> {
  const row = (await rows()).find((item) => within(item).queryByRole('heading', { name }));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

describe('home recent uploads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    track.mockClear();
    openDocumentDownload.mockClear();
  });

  it('asks the feed for five uploads', async () => {
    renderHome();

    await rows();
    expect(requests).toContain('/demi-search/documents/recent-uploads?limit=5');
  });

  it('lists a block per project, named and dated', async () => {
    renderHome();

    const list = await rows();
    expect(list).toHaveLength(5);
    expect(list.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual(
      [
        'Cedar LNG',
        'Kitimat Terminal',
        'Highway 1 Widening',
        'Murray River Coal',
        'Willow Creek Wind',
      ],
    );
    expect(list[0]).toHaveTextContent('September 1, 2026');
    expect(list[1]).toHaveTextContent('August 31, 2026');
  });

  it('sends the project link to its documents table, newest posted first', async () => {
    renderHome();
    await rows();

    expect(href('Cedar LNG')).toBe('/p/eagle-1/documents?sortBy=-datePosted');
  });

  it('leaves a project Eagle has no row for unlinked, and still lists its documents', async () => {
    renderHome();
    const row = await rowFor('Willow Creek Wind');

    // No route resolves a DEMI id, so the name is text and there is no table to send anyone to.
    expect(within(row).queryByRole('link', { name: 'Willow Creek Wind' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: /^All documents/ })).not.toBeInTheDocument();
    // Documents open by their own id, which works with or without an Eagle project row.
    expect(within(row).getByRole('link', { name: 'Correspondence' })).toHaveAttribute(
      'href',
      '/demi-search/documents/d5/download?redirect=1',
    );
  });

  it('shows every project its documents at once, with nothing to expand', async () => {
    renderHome();
    const list = await rows();

    expect(within(list[0]!).getByRole('link', { name: 'Application part 1' })).toBeInTheDocument();
    expect(
      within(list[0]!).getByRole('link', { name: 'Certificate decision letter' }),
    ).toBeInTheDocument();
    expect(within(list[0]!).getByRole('link', { name: 'Covering letter' })).toBeInTheDocument();
    // Another project's document sits in its own card, not behind an expander.
    expect(within(list[1]!).getByRole('link', { name: 'Certificate' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /documents for Cedar LNG/i }),
    ).not.toBeInTheDocument();
  });

  it('links each document at its own download URL', async () => {
    renderHome();
    await rows();

    expect(href('Application part 1')).toBe('/demi-search/documents/d1/download?redirect=1');
    expect(href('Certificate')).toBe('/demi-search/documents/d2/download?redirect=1');
  });

  it('downloads the document instead of navigating', async () => {
    renderHome();
    await rows();

    await userEvent.setup().click(screen.getByRole('link', { name: 'Covering letter' }));

    expect(openDocumentDownload).toHaveBeenCalledWith({
      _id: 'd1c',
      displayName: 'Covering letter',
    });
    // The click never left the home page.
    expect(screen.getByRole('heading', { name: 'Recent Uploads' })).toBeInTheDocument();
  });

  it('names the document type, and the date only when it differs from the project', async () => {
    renderHome();
    const row = await rowFor('Cedar LNG');

    const documentRow = (name: string) => within(row).getByRole('link', { name }).closest('li')!;

    // Type and date share one meta line under the name.
    expect(documentRow('Certificate decision letter')).toHaveTextContent(
      'Certificate Package \u00b7 August 27, 2026',
    );
    expect(documentRow('Covering letter')).toHaveTextContent('Letter \u00b7 August 26, 2026');
    // The newest document shares the project's date, so only the project line carries it, and that
    // document's meta line is left with the type alone.
    expect(documentRow('Application part 1')).toHaveTextContent(/Application Materials$/);
    expect(within(row).getAllByText('September 1, 2026')).toHaveLength(1);
  });

  it('closes each linked project block with an All documents link that names its project', async () => {
    renderHome();
    await rows();

    const allDocuments = screen.getAllByRole('link', { name: /^All documents for / });
    expect(allDocuments).toHaveLength(4);
    // The project only extends the name a reader hears; the label on screen stays short.
    allDocuments.forEach((link) => expect(link).toHaveTextContent(/^All documents/));
    expect(href('All documents for Kitimat Terminal')).toBe(
      '/p/eagle-2/documents?sortBy=-datePosted',
    );
  });

  it.each([
    ['the project name', 'Cedar LNG', null, 'project'],
    ['a document', 'Certificate decision letter', 'd1b', 'document'],
    ['the block link', 'All documents for Cedar LNG', null, 'all-documents'],
  ])('reports a click on %s', async (_label, name, documentId, target) => {
    renderHome();
    await rows();

    await userEvent.setup().click(screen.getByRole('link', { name: name as string }));

    expect(track).toHaveBeenLastCalledWith('Recent Upload Clicked', {
      project_id: 'eagle-1',
      project_name: 'Cedar LNG',
      document_id: documentId,
      target,
    });
  });

  it('drops the whole section when there is nothing to list', async () => {
    renderHome({ items: [] });

    // The heading is there while the request is in flight, so waiting for it to go proves the
    // empty answer arrived rather than catching the page before it did.
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Recent Uploads' }),
    );
    expect(screen.getByText('Recent Activities & Updates')).toBeInTheDocument();
  });

  it('asks the failing feed once, whatever the client retries', async () => {
    renderHome({ uploadsStatus: 500, retries: true });

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Recent Uploads' }),
    );
    expect(requests.filter((url) => url.includes('/documents/recent-uploads'))).toHaveLength(1);
  });

  it('drops the section when the request fails, leaving the rest of the page', async () => {
    renderHome({ uploadsStatus: 500 });

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Recent Uploads' }),
    );
    expect(screen.getByText('Recent Activities & Updates')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'About the B.C. Environmental Assessment Process' }),
    ).toBeInTheDocument();
  });
});
