import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openDocumentDownload } from 'app/utils/utils';
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

const PROJECT = {
  _id: 'proj1',
  name: 'Site C',
  type: 'Energy-Electricity',
  sector: 'Hydroelectric',
  proponent: { name: 'BC Hydro' },
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
    // eagle-api deletes the author field on anonymous comments rather than nulling it.
    _id: 'c2',
    comment: 'Anonymous comment',
    dateAdded: '2026-08-02T00:00:00.000Z',
    documents: [],
  },
];

interface Sent {
  url: string;
  init?: RequestInit;
}

let sent: Sent[];
let commentCount: number;

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
        return json([{ searchResults: [PERIOD], meta: [{ searchResultsTotal: 1 }] }]);
      if (url.startsWith('/api/project/proj1?populate')) return json([PROJECT]);
      if (url.startsWith('/api/search?dataset=ProjectNotification'))
        return json([{ searchResults: [{ _id: 'pn1', name: 'Notified Project' }] }]);
      if (url.startsWith('/api/public/comment')) {
        return json(COMMENTS.slice(0, commentCount), { 'x-total-count': String(commentCount) });
      }
      if (url.startsWith('/api/document?docIds=')) {
        return json([
          { _id: 'relatedDoc1', displayName: 'Related report.pdf' },
          { _id: 'commentDoc1', internalOriginalName: 'attachment.pdf', documentSource: 'COMMENT' },
        ]);
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
    { path: '/project-notifications', element: <h1>Notifications page</h1> },
  ]).router;
}

function lastCommentListUrl(): string | undefined {
  return sent.filter((entry) => entry.url.startsWith('/api/public/comment?period=')).at(-1)?.url;
}

describe('comments', () => {
  beforeEach(() => {
    sent = [];
    commentCount = 2;
    vi.mocked(openDocumentDownload).mockClear();
    stubFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the comment period header, instructions and project details', async () => {
    renderComments();

    expect(await screen.findByRole('heading', { level: 1, name: 'Site C' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Public Comment Period is Now Open' }),
    ).toBeInTheDocument();
    expect(document.querySelector('#instructions')?.innerHTML).toBe(
      '<p id="instruction-body">Read the guidance</p>',
    );
    expect(screen.getByText('Additional text here')).toBeInTheDocument();
    expect(screen.getByText('Information label here')).toBeInTheDocument();
    expect(screen.getByText('Certificate Issued')).toBeInTheDocument();
    expect(screen.getByText('BC Hydro')).toBeInTheDocument();
    expect(screen.getByText('Hydroelectric')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Project Details' })).toBeInTheDocument();
  });

  it('lists the related documents and open houses', async () => {
    renderComments();

    expect(await screen.findByText('Related report.pdf')).toBeInTheDocument();
    expect(screen.getByText('Related Documents')).toBeInTheDocument();
    expect(screen.getByText('Open Houses')).toBeInTheDocument();
    expect(screen.getByText('Community hall')).toBeInTheDocument();
  });

  it('renders comments through the table engine, resolving attachments in one batch', async () => {
    renderComments();

    expect(await screen.findByText('First comment')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.getByText(', Victoria')).toBeInTheDocument();
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(screen.getByText('attachment.pdf')).toBeInTheDocument();

    const docRequests = sent.filter((entry) =>
      entry.url.startsWith('/api/document?docIds=commentDoc1'),
    );
    expect(docRequests).toHaveLength(1);
  });

  /**
   * Both download paths hand the document to `openDocumentDownload`, which asks demi-api for a
   * presigned URL and falls back to eagle-api. Fetching that URL from script is barred by the
   * deployed CSP, so nothing here may fetch it.
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

  it('requests the first page of comments with a count', async () => {
    renderComments();

    await screen.findByText('First comment');
    const listRequest = sent.find((entry) =>
      entry.url.startsWith('/api/public/comment?period=cp1'),
    );
    expect(listRequest?.url).toBe(
      '/api/public/comment?period=cp1&fields=author|comment|documents|commentId|dateAdded|dateUpdated|isAnonymous|location|period|read|write|delete&sortBy=-commentId&pageNum=0&pageSize=10&count=true&',
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

  it('says so when there are no comments', async () => {
    commentCount = 0;
    renderComments();

    expect(await screen.findByText('There are no comments.')).toBeInTheDocument();
  });

  it('goes back to the project page', async () => {
    const router = renderComments();

    await userEvent.click(await screen.findByRole('button', { name: 'Back to Project Details' }));
    expect(router.state.location.pathname).toBe('/p/proj1');
  });

  it('names a project notification from search and sends Back to the notifications list', async () => {
    const router = renderComments('/pn/pn1/cp/cp1/details');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notified Project' }),
    ).toBeInTheDocument();
    expect(
      sent.some((entry) => entry.url.startsWith('/api/search?dataset=ProjectNotification')),
    ).toBe(true);
    expect(sent.some((entry) => entry.url.startsWith('/api/project/pn1'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Back to Project Notifications' }));
    expect(router.state.location.pathname).toBe('/project-notifications');
  });

  it('offers no way to submit a comment on an open period', async () => {
    renderComments();

    await screen.findByRole('heading', { level: 2, name: 'Public Comment Period is Now Open' });
    // The comment list settling is what puts the whole page on screen; asserting before it
    // would pass whether or not the entry point is there.
    await screen.findByText('First comment');
    expect(screen.queryByRole('button', { name: /Submit|Add.*Comment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
