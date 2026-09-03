import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../../test-utils';
import { Comments } from './comments';

const DAY = 24 * 60 * 60 * 1000;

const PERIOD = {
  _id: 'cp1',
  dateStarted: new Date(Date.now() - DAY).toISOString(),
  dateCompleted: new Date(Date.now() + DAY).toISOString(),
  instructions: '<p id="instruction-body">Read the guidance</p>',
  additionalText: 'Additional text here',
  informationLabel: 'Information label here',
  commentTip: '<em>Keep it on topic</em>',
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
  projectCAC: true,
  projectCACPublished: true,
  cacEmail: 'cac@example.com',
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
    _id: 'c2',
    author: null,
    comment: 'Anonymous comment',
    dateAdded: '2026-08-02T00:00:00.000Z',
    documents: [],
  },
];

const LISTS = [{ _id: 'authorTypeId', type: 'author', name: 'Public' }];

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
      const method = init?.method ?? 'GET';
      sent.push({ url, init });

      if (url.startsWith('/api/commentperiod/')) return json([PERIOD]);
      if (url.startsWith('/api/project/proj1?populate')) return json([PROJECT]);
      if (url.includes('/cacSignUp')) return json({});
      if (url.startsWith('/api/search?dataset=ProjectNotification'))
        return json([{ searchResults: [{ _id: 'pn1', name: 'Notified Project' }] }]);
      if (url.startsWith('/api/search?pageSize=250&dataset=List'))
        return json([{ searchResults: LISTS }]);
      if (url.startsWith('/api/public/comment') && method === 'POST')
        return json({ _id: 'newComment', author: 'Anonymous' });
      if (url.startsWith('/api/public/comment')) {
        return json(COMMENTS.slice(0, commentCount), { 'x-total-count': String(commentCount) });
      }
      if (url.startsWith('/api/document/') && method === 'POST')
        return json({ _id: 'uploadedDoc' });
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

function postedTo(fragment: string): Sent[] {
  return sent.filter((entry) => entry.url.includes(fragment) && entry.init?.method === 'POST');
}

/** Walks pages 1 -> 5 of the modal, the shortest route to the comment form. */
async function openCommentForm() {
  renderComments();
  await userEvent.click(await screen.findByRole('button', { name: 'Submit Comment' }));
  await userEvent.click(await screen.findByLabelText(/I have read the above/));
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByLabelText('Location *');
}

describe('comments', () => {
  beforeEach(() => {
    // jsdom ships the <dialog> element but none of its methods.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
    sent = [];
    commentCount = 2;
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

  it('opens the modal and closes it again on the header close button', async () => {
    renderComments();

    await userEvent.click(await screen.findByRole('button', { name: 'Submit Comment' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Submit a Comment' })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText('Close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the modal on Escape', async () => {
    renderComments();

    await userEvent.click(await screen.findByRole('button', { name: 'Submit Comment' }));
    fireEvent(
      await screen.findByRole('dialog'),
      new Event('cancel', { cancelable: true, bubbles: false }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('gates page 1 behind the conditions checkbox', async () => {
    renderComments();

    await userEvent.click(await screen.findByRole('button', { name: 'Submit Comment' }));
    const next = await screen.findByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();

    await userEvent.click(screen.getByLabelText(/I have read the above/));
    expect(next).toBeEnabled();
  });

  it('skips the CAC pages until Learn More has been seen', async () => {
    await openCommentForm();

    // straight to the comment form; the CAC pages are only reachable through Learn More
    expect(screen.getByLabelText('Your Comment Submission*')).toBeInTheDocument();
    expect(screen.queryByText('What is a Community Advisory Committee?')).not.toBeInTheDocument();
  });

  it('walks the full CAC sign-up and comment submission flow', async () => {
    await openCommentForm();

    // page 5 -> 2 via Learn More
    await userEvent.click(screen.getByRole('button', { name: 'Learn More' }));
    expect(await screen.findByText('What is a Community Advisory Committee?')).toBeInTheDocument();

    // page 2 -> 3
    await userEvent.click(screen.getByRole('button', { name: 'Become a Member' }));
    const complete = await screen.findByRole('button', { name: 'Complete Submission' });
    expect(complete).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Full Name *'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email Address *'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Confirm Email Address *'), 'jane@example.co');
    await userEvent.click(screen.getByLabelText(/I acknowledge that I understand the above text/));
    await userEvent.click(screen.getByLabelText(/will abide by the/));
    expect(complete).toBeDisabled(); // emails still differ

    await userEvent.type(screen.getByLabelText('Confirm Email Address *'), 'm');
    expect(complete).toBeEnabled();

    // page 3 -> 4
    await userEvent.click(complete);
    expect(
      await screen.findByText('Thank you for becoming a Community Advisory Committee Member'),
    ).toBeInTheDocument();
    const signUp = postedTo('/cacSignUp');
    expect(signUp).toHaveLength(1);
    expect(signUp[0].url).toBe('/api/project/proj1/cacSignUp');
    expect(JSON.parse(String(signUp[0].init?.body))).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      liveNear: false,
      liveNearInput: '',
      memberOf: false,
      memberOfInput: '',
      knowledgeOf: false,
      knowledgeOfInput: '',
      additionalNotes: '',
    });

    // page 4 -> 5
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Commenting' }));
    const submit = await screen.findByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();

    // the comment tip is rendered as HTML
    expect(document.querySelector('.comment-tip-container p')?.innerHTML).toBe(
      '<em>Keep it on topic</em>',
    );

    await userEvent.type(screen.getByLabelText('Location *'), 'Victoria');
    expect(submit).toBeDisabled(); // still needs a comment or an attachment

    await userEvent.type(
      screen.getByLabelText('Your Comment Submission*'),
      'Please consider the fish.',
    );
    expect(submit).toBeEnabled();

    // attach a file, then take it away again
    const file = new File(['data'], 'evidence.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    expect(await screen.findByText('evidence.pdf')).toBeInTheDocument();
    expect(screen.queryByText('No attached files.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Remove this file'));
    expect(screen.getByText('No attached files.')).toBeInTheDocument();

    // put it back and submit
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await screen.findByText('evidence.pdf');

    await userEvent.click(submit);
    expect(await screen.findByText('Your comment has been submitted!')).toBeInTheDocument();

    const commentPost = postedTo('/api/public/comment');
    expect(commentPost).toHaveLength(1);
    expect(commentPost[0].url).toBe('/api/public/comment?fields=comment|author');
    expect(JSON.parse(String(commentPost[0].init?.body))).toEqual({
      author: 'Anonymous',
      comment: 'Please consider the fish.',
      commentId: null,
      dateAdded: null,
      dateUpdated: null,
      delete: null,
      documents: null,
      documentsList: [],
      isAnonymous: true,
      location: 'Victoria',
      period: 'cp1',
      read: null,
      submittedCAC: true,
      write: null,
    });

    const documentPost = postedTo('/api/document/');
    expect(documentPost).toHaveLength(1);
    expect(documentPost[0].url).toBe(
      '/api/document/?fields=documentFileName|displayName|internalURL|internalMime',
    );
    const form = documentPost[0].init?.body as FormData;
    expect(form.get('_comment')).toBe('newComment');
    expect(form.get('displayName')).toBe('evidence.pdf');
    expect(form.get('documentSource')).toBe('COMMENT');
    expect(form.get('documentAuthor')).toBe('Anonymous');
    expect(form.get('documentAuthorType')).toBe('authorTypeId');
    expect(form.get('project')).toBe('proj1');
    expect(form.get('documentFileName')).toBe('evidence.pdf');
    expect(form.get('internalOriginalName')).toBe('evidence.pdf');
    expect(form.get('upfile')).toBe(file);
    expect(form.getAll('documentSource')).toHaveLength(1);

    // page 6 -> closed
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits the commenter name once they opt in to showing it', async () => {
    await openCommentForm();

    await userEvent.type(screen.getByLabelText('Location *'), 'Victoria');
    await userEvent.type(screen.getByLabelText('Your Comment Submission*'), 'A comment.');

    const submit = screen.getByRole('button', { name: 'Submit' });
    await userEvent.click(screen.getByLabelText(/Please make my name visible to the public/));
    expect(submit).toBeDisabled(); // the name field is now required and was cleared

    const nameField = document.querySelector('#nameInput') as HTMLInputElement;
    await userEvent.type(nameField, 'Jane Doe');
    expect(submit).toBeEnabled();

    await userEvent.click(submit);
    await screen.findByText('Your comment has been submitted!');

    expect(JSON.parse(String(postedTo('/api/public/comment')[0].init?.body))).toMatchObject({
      author: 'Jane Doe',
      isAnonymous: false,
    });
  });
});
