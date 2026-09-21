import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openDocumentDownload } from 'app/utils/utils';
import { loadConfig } from 'app/config/config';
import { queryClient } from 'app/api/query-client';
import { renderAt } from '../../../test-utils';
import { Comments } from './comments';

vi.mock('app/utils/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/utils/utils')>()),
  openDocumentDownload: vi.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;

const PERIOD = {
  _id: 'cp1',
  dateStarted: new Date(Date.now() - DAY).toISOString(),
  dateCompleted: new Date(Date.now() + DAY).toISOString(),
  instructions: '<p id="instruction-body">Read the guidance</p>',
  additionalText: 'Additional text here',
  informationLabel: 'Information label here',
  relatedDocuments: ['relatedDoc1'],
  openHouses: [{ eventDate: '2026-09-01T00:00:00.000Z', description: 'Community hall' }],
};

/** The project as DEMI answers it: Track's field names, the proponent as a bare scalar. */
const DEMI_PROJECT = {
  eagleId: 'proj1',
  name: 'Site C',
  projectType: 'Energy-Electricity',
  sector: 'Hydroelectric',
  proponentName: 'BC Hydro',
  eacDecision: { name: 'Certificate Issued' },
};

const COMMENTS = [
  {
    _id: 'c1',
    author: 'Jane',
    location: 'Victoria',
    comment: 'First comment',
    dateAdded: '2026-08-01T00:00:00.000Z',
    documents: ['commentDoc1'],
  },
  {
    // An anonymous comment carries no author field at all rather than a null one, but eagle-api
    // keeps its location.
    _id: 'c2',
    location: 'Nanaimo',
    comment: 'Anonymous comment',
    dateAdded: '2026-08-02T00:00:00.000Z',
    documents: [],
  },
];

// Trailing `&` on purpose: without it these also match dataset=CommentPeriod and DocumentChunk.
const DOCUMENTS = [
  { _id: 'relatedDoc1', displayName: 'Related report.pdf' },
  { _id: 'unnamedDoc', displayName: null },
  { _id: 'commentDoc1', internalOriginalName: 'attachment.pdf', documentSource: 'COMMENT' },
];

const COMMENT_LIST_PREFIX = '/demi-search/search?dataset=Comment&';
const DOCUMENT_PREFIX = '/demi-search/search?dataset=Document&';

interface Sent {
  url: string;
  init?: RequestInit;
}

let sent: Sent[];
let commentCount: number;
let period: typeof PERIOD;
let demiProject: Record<string, unknown>;

function json(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      sent.push({ url, init });

      if (url.includes('dataset=CommentPeriod'))
        return json([{ searchResults: [period], meta: [{ searchResultsTotal: 1 }] }]);
      if (url.startsWith('/demi-projects/proj1')) return json(demiProject);
      if (url.startsWith('/demi-search/search?dataset=ProjectNotification'))
        return json([{ searchResults: [{ _id: 'pn1', name: 'Notified Project' }] }]);
      if (url.startsWith(COMMENT_LIST_PREFIX)) {
        return json([
          {
            searchResults: COMMENTS.slice(0, commentCount),
            meta: [{ searchResultsTotal: commentCount }],
          },
        ]);
      }
      if (url.startsWith(`${DOCUMENT_PREFIX}docIds=`)) {
        const ids = new URL(url, 'http://x').searchParams.get('docIds')?.split('|') ?? [];
        return json([{ searchResults: DOCUMENTS.filter((doc) => ids.includes(doc._id)) }]);
      }
      return json([]);
    }),
  );
}

function renderComments(path = '/p/proj1/cp/cp1/details') {
  return renderAt(path, [
    { path: '/p/:projId/cp/:commentPeriodId/details', Component: Comments },
    { path: '/pn/:projId/cp/:commentPeriodId/details', Component: Comments },
    { path: '/p/:projId', element: <h1>Project page</h1> },
    { path: '/search', element: <h1>Search page</h1> },
  ]).router;
}

function lastCommentListUrl(): string | undefined {
  return sent.filter((entry) => entry.url.startsWith(COMMENT_LIST_PREFIX)).at(-1)?.url;
}

describe('comments', () => {
  const originalEnv = window.__env;

  beforeEach(async () => {
    sent = [];
    commentCount = 2;
    period = PERIOD;
    demiProject = DEMI_PROJECT;
    // The project read goes through the app-wide cache, which would otherwise carry one test's
    // project into the next.
    queryClient.clear();
    // jsdom has no scrollIntoView; the grid calls it on a page change.
    Element.prototype.scrollIntoView = vi.fn();
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '/demi-projects' };
    await loadConfig();
    vi.mocked(openDocumentDownload).mockClear();
    stubFetch();
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.unstubAllGlobals();
  });

  /** The blue band, once the project name is in its h1. */
  async function findBanner(name = 'Site C'): Promise<HTMLElement> {
    const heading = await screen.findByRole('heading', { level: 1, name });
    const band = heading.closest('.page-masthead.comment-banner');
    expect(band, 'the title is not in the comment banner').not.toBeNull();
    return band as HTMLElement;
  }

  it('holds the period, its instructions and the project facts in the banner under the title', async () => {
    renderComments();

    const band = await findBanner();

    const [status, dates] = within(band).getAllByRole('heading', { level: 2 });
    expect(status).toHaveTextContent('Public Comment Period is Now Open');
    expect(dates.textContent).toMatch(
      /^\w{3} \d{1,2}, \d{4} - \w+ \d{2} @ \d{2}:\d{2} [AP]M P[DS]T$/,
    );
    expect(band.querySelector('#instructions')?.innerHTML).toBe(
      '<p id="instruction-body">Read the guidance</p>',
    );
    expect(within(band).getByText('Additional text here')).toBeInTheDocument();
    expect(within(band).getByText('Information label here')).toBeInTheDocument();

    const fact = (term: string) =>
      within(band).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(fact('Proponent')).toBe('BC Hydro');
    expect(fact('Type')).toBe('Energy-Electricity');
    expect(fact('Sub-type')).toBe('Hydroelectric');
  });

  it.each([
    ['Certificate Issued', 'success'],
    ['Certificate Refused', 'danger'],
    ['Assessment Terminated', 'danger'],
    ['Exemption Order', 'info'],
  ])('shows the "%s" decision in the banner as a read-only %s pill', async (decision, tone) => {
    demiProject = { ...DEMI_PROJECT, eacDecision: { name: decision } };
    renderComments();

    const pill = within(await findBanner()).getByText(decision);
    expect(pill).toHaveClass('status-pill', `status-pill--${tone}`);
    expect(pill.closest('button, a')).toBeNull();
  });

  it('leaves the decision pill out when the project has none', async () => {
    demiProject = { ...DEMI_PROJECT, eacDecision: undefined };
    renderComments();

    const band = await findBanner();
    expect(within(band).getByText('Proponent', { selector: 'dt' })).toBeInTheDocument();
    expect(band.querySelector('.status-pill')).toBeNull();
  });

  it('leaves the main landmark to the app shell', async () => {
    renderComments();

    await findBanner();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('lists the related documents and open houses in the banner, and downloads a document', async () => {
    renderComments();

    const band = await findBanner();
    const docs = await within(band).findByRole('region', { name: 'Related Documents' });
    await userEvent.click(within(docs).getByRole('button', { name: /Related report.pdf/ }));
    expect(openDocumentDownload).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'relatedDoc1' }),
    );

    const openHouses = within(band).getByRole('region', { name: 'Open Houses' });
    expect(within(openHouses).getByText('Community hall')).toBeInTheDocument();
  });

  it('leaves an unnamed related document blank on its own row, still named for a screen reader', async () => {
    period = { ...PERIOD, relatedDocuments: ['relatedDoc1', 'unnamedDoc'] };
    renderComments();

    const docs = await screen.findByRole('region', { name: 'Related Documents' });
    const unnamed = await within(docs).findByRole('button', { name: 'Download unnamed document' });
    const label = unnamed.querySelector('span');
    expect(label).toHaveTextContent(/^$/);
    expect(label).not.toHaveAttribute('title');
    expect(unnamed.closest('li')?.parentElement).toBe(docs.querySelector('ul'));
    expect(docs.textContent).not.toMatch(/undefined|null|[-·|,]\s*$/);

    await userEvent.click(unnamed);
    expect(openDocumentDownload).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'unnamedDoc' }),
    );
  });

  it('leaves out the document and open house cards when the period has neither', async () => {
    period = { ...PERIOD, relatedDocuments: [], openHouses: [] };
    renderComments();

    await findBanner();
    await screen.findByText('First comment');
    expect(screen.queryByRole('region', { name: 'Related Documents' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Open Houses' })).not.toBeInTheDocument();
  });

  it('ends the banner with Back in the on-dark button style', async () => {
    renderComments();

    const band = await findBanner();
    expect(within(band).getByRole('button', { name: 'Back to Project Details' })).toHaveClass(
      'btn-on-dark',
    );
    expect(band).not.toHaveAttribute('aria-busy');
  });

  it.each([
    [
      'Public Comment Period is Now Closed',
      '2017-04-05T19:00:00.000Z',
      '2017-05-04T16:00:00.000Z',
      'Apr 5, 2017 - May 04 @ 09:00 AM PDT',
    ],
    [
      'Public Comment Period is Upcoming',
      new Date(Date.now() + DAY).toISOString(),
      new Date(Date.now() + 30 * DAY).toISOString(),
      null,
    ],
  ])('states "%s" and the date range under the title', async (status, start, end, range) => {
    period = { ...PERIOD, dateStarted: start, dateCompleted: end };
    renderComments();

    const [heading, dates] = within(await findBanner()).getAllByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent(status);
    if (range) expect(dates).toHaveTextContent(range);
  });

  it('leads back through the project in the banner trail', async () => {
    renderComments();

    const band = await findBanner();
    const trail = within(band).getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(trail).getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/search?record=projects',
    );
    expect(within(trail).getByRole('link', { name: 'Site C' })).toHaveAttribute('href', '/p/proj1');
    expect(within(trail).getByText('Comment period')).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('navigation', { name: 'Breadcrumb' })).toHaveLength(1);
  });

  it('holds the banner busy, with no Back button, until the period loads', async () => {
    renderComments();

    const loading = screen.getByText('Loading comment period');
    expect(loading.closest('.page-masthead')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button', { name: /Back to/ })).not.toBeInTheDocument();
    expect(await findBanner()).not.toHaveAttribute('aria-busy');
  });

  it('leaves the project facts off a project notification period', async () => {
    renderComments('/pn/pn1/cp/cp1/details');

    const band = await findBanner('Notified Project');
    expect(within(band).getByText('Additional text here')).toBeInTheDocument();
    expect(within(band).queryByText('Proponent', { selector: 'dt' })).not.toBeInTheDocument();
    expect(band.querySelector('.status-pill')).toBeNull();
    expect(within(band).getByText('Public Comment Period is Now Open')).toBeInTheDocument();
  });

  it('lists each comment under its author, with place and files, resolving files in one batch', async () => {
    renderComments();

    expect(await screen.findByText('First comment')).toBeInTheDocument();
    const [jane, anonymous] = screen
      .getAllByRole('listitem')
      .filter((item) => within(item).queryByRole('heading', { level: 3 }));
    expect(within(jane).getByRole('heading', { level: 3 })).toHaveTextContent('Jane');
    expect(within(jane).getByText(/August 1, 2026.*Victoria$/)).toBeInTheDocument();
    expect(within(jane).getByText('1 document')).toBeInTheDocument();
    expect(within(jane).getByRole('link', { name: 'attachment.pdf' })).toHaveAttribute(
      'href',
      '/demi-search/documents/commentDoc1/download?redirect=1',
    );
    expect(within(anonymous).getByRole('heading', { level: 3 })).toHaveTextContent('Anonymous');
    expect(within(anonymous).getByText('Anonymous comment')).toBeInTheDocument();

    const docRequests = sent.filter((entry) =>
      entry.url.startsWith(`${DOCUMENT_PREFIX}docIds=commentDoc1`),
    );
    expect(docRequests).toHaveLength(1);
  });

  /**
   * Both download paths hand the document to `openDocumentDownload`, which asks demi-api for a
   * presigned URL. Fetching that URL from script is barred by the deployed CSP, so nothing here may
   * fetch it.
   */
  it('downloads a comment attachment through the presigned path', async () => {
    renderComments();

    await userEvent.click(await screen.findByText('attachment.pdf'));

    expect(openDocumentDownload).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'commentDoc1' }),
    );
  });

  it('downloads a related document through the presigned path', async () => {
    renderComments();

    await userEvent.click(await screen.findByText('Related report.pdf'));

    expect(openDocumentDownload).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'relatedDoc1' }),
    );
  });

  it('requests the first page of the period comments, newest first', async () => {
    renderComments();

    await screen.findByText('First comment');
    const listRequest = sent.find((entry) => entry.url.startsWith(COMMENT_LIST_PREFIX));
    expect(listRequest?.url).toBe(
      `${COMMENT_LIST_PREFIX}pageNum=0&pageSize=10&projectLegislation=default&sortBy=-commentId&populate=false&and[period]=cp1&fuzzy=false`,
    );
  });

  it('pages through comments and returns to page one on a page-size change', async () => {
    commentCount = 25;
    renderComments();

    await screen.findByText('First comment');
    await userEvent.click(screen.getAllByLabelText('Go to page 2')[0]);
    await waitFor(() => expect(lastCommentListUrl()).toContain('&pageNum=1&pageSize=10&'));

    await userEvent.click(screen.getAllByTitle('Show 25 records per page')[0]);
    await waitFor(() => expect(lastCommentListUrl()).toContain('&pageNum=0&pageSize=25&'));
  });

  it('counts the comments above the list, with a pager beside the count', async () => {
    commentCount = 25;
    renderComments();

    const count = await screen.findByText('1–10 of 25 comments');
    expect(count).toHaveAttribute('role', 'status');
    const bar = count.closest('.display-grid__bar') as HTMLElement;
    const topPager = within(bar).getByRole('navigation', { name: 'Comment pages, top' });

    await userEvent.click(within(topPager).getByLabelText('Go to page 2'));
    await waitFor(() => expect(lastCommentListUrl()).toContain('&pageNum=1&pageSize=10&'));
    expect(await screen.findByText('11–20 of 25 comments')).toBeInTheDocument();
    // The bottom pager stays.
    expect(screen.getByRole('navigation', { name: 'Result pages' })).toBeInTheDocument();
  });

  it('says so when there are no comments', async () => {
    commentCount = 0;
    renderComments();

    expect(await screen.findByText('There are no comments.')).toBeInTheDocument();
  });

  it('holds back the no-comments message until the period and its comments have loaded', async () => {
    commentCount = 0;
    renderComments();

    expect(screen.getByText('Loading comment period')).toBeInTheDocument();
    expect(screen.queryByText('There are no comments.')).not.toBeInTheDocument();
    expect(await screen.findByText('There are no comments.')).toBeInTheDocument();
  });

  it('keeps the place off an anonymous comment and shows it on a named one', async () => {
    renderComments();

    await screen.findByText('Anonymous comment');
    const [named, anonymous] = screen
      .getAllByRole('listitem')
      .filter((item) => within(item).queryByRole('heading', { level: 3 }));
    expect(within(named).getByText(/Victoria$/)).toBeInTheDocument();
    expect(within(anonymous).queryByText(/Nanaimo/)).not.toBeInTheDocument();
  });

  it('goes back to the project page', async () => {
    const router = renderComments();

    await userEvent.click(await screen.findByRole('button', { name: 'Back to Project Details' }));
    expect(router.state.location.pathname).toBe('/p/proj1');
  });

  it('names a project notification from search and sends Back to the notifications list', async () => {
    const router = renderComments('/pn/pn1/cp/cp1/details');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Notified Project' });
    // A notification has no EA decision to show.
    expect(within(heading.closest('.page-masthead') as HTMLElement).queryByText('-')).toBeNull();
    expect(
      sent.some((entry) => entry.url.startsWith('/demi-search/search?dataset=ProjectNotification')),
    ).toBe(true);
    expect(sent.some((entry) => entry.url.startsWith('/demi-projects/pn1'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Back to Project Notifications' }));
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/search?record=notifications',
    );
  });

  it('offers no way to submit a comment on an open period', async () => {
    renderComments();

    await screen.findByText('Public Comment Period is Now Open');
    // The comment list settling is what puts the whole page on screen; asserting before it
    // would pass whether or not the entry point is there.
    await screen.findByText('First comment');
    expect(screen.queryByRole('button', { name: /Submit|Add.*Comment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
