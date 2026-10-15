import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { track } from 'app/analytics/analytics';
import { loadConfig } from 'app/config/config';
import { queryClient } from 'app/api/query-client';
import { routes } from 'app/routes';
import { renderAt } from '../../../test-utils';
import { nativeDocument, type PageDocument } from 'app/models/demi/document.fixture';
import { json, native } from '../home/home-fetch.spec-helper';
import { NotificationPage } from './notification-page';

vi.mock('app/analytics/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/analytics/analytics')>()),
  track: vi.fn(),
}));

/** A Mongo ObjectId: a notification keeps its Eagle id as its DEMI id. */
const ID = '5c8a3a3ce7f1f1002466c2b1';

/** A native `/notifications/:id` row with no associated project and no centroid. */
const NOTIFICATION = {
  id: ID,
  name: 'Bear Creek Aggregate',
  description: 'Expansion of a gravel pit.',
  type: 'Mines',
  region: 'Cariboo',
  location: 'Near Quesnel',
  proponent: 'Acme Aggregates Ltd.',
  decision: 'In Progress',
};

/** One document type and one milestone, as DEMI's native `/lists` returns them. */
const LISTS = [
  { id: 'type-letter', name: 'Notification Letter', legislation: 2018, type: 'doctype' },
  { id: 'ms-notice', name: 'Notice Received', legislation: 2018, type: 'label' },
];

/** A notification document typed with the list ids above. */
const TYPED_DOCUMENT = {
  _id: 'doc-1',
  displayName: 'Notification letter',
  type: 'type-letter',
  milestone: 'ms-notice',
  datePosted: '2026-05-01T00:00:00.000Z',
  internalSize: '2097152',
  isFeatured: true,
};

const originalEnv = window.__env;

let notification: Record<string, unknown> | undefined;
let notificationFails: boolean;
let lists: unknown[];
let documentRow: PageDocument;
let requests: string[];
/** Set by a test that holds the notification read back; resolves it when called. */
let holdNotification: Promise<void> | undefined;

/** The documents reads the page and its tabs send, filed under the notification's own id. */
const DOCUMENT_READ = '/demi/api/documents?';

function stubFetch() {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith('/demi/api/notifications/')) {
        await holdNotification;
        if (notificationFails) return new Response('', { status: 500 });
        return notification ? json(notification) : json(null, 404);
      }
      if (url.includes('/demi/api/lists')) return native(lists);
      // DEMI files no period record under this notification.
      if (url.includes('/demi/api/comment-periods')) return native([]);
      if (url.startsWith(DOCUMENT_READ)) return native([nativeDocument(documentRow)]);
      return native([]);
    }),
  );
}

function renderPage(path = `/pn/${ID}/overview`) {
  stubFetch();
  return renderAt(
    path,
    [
      {
        path: '/pn/:projId',
        Component: NotificationPage,
        children: [
          { path: 'overview', element: <div>overview body</div> },
          { path: 'engagement', element: <div>engagement body</div> },
          { path: 'documents', element: <div>documents body</div> },
        ],
      },
    ],
    { queryClient },
  );
}

/** Reads keyed to this record: everything but the app-wide lists, which the shell reads up front. */
function recordRequests(): string[] {
  return requests.filter((url) => !url.includes('/demi/api/lists'));
}

function strip(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Project notification sections' });
}

beforeEach(async () => {
  notification = { ...NOTIFICATION };
  notificationFails = false;
  lists = [];
  documentRow = { _id: 'doc-1', displayName: 'Notification letter' };
  holdNotification = undefined;
  window.__env = { logLevel: 4 };
  await loadConfig();
  queryClient.clear();
  vi.mocked(track).mockClear();
});

afterEach(() => {
  window.__env = originalEnv;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('project notification page', () => {
  it('heads the page with the notification name, labelled as a project notification', async () => {
    renderPage();

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Bear Creek Aggregate' },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Project notification · Acme Aggregates Ltd. · Near Quesnel'),
    ).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/search?record=notifications',
    );
  });

  it('reads the notification by the id in the route', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Bear Creek Aggregate' });
    expect(requests).toContain(`/demi/api/notifications/${ID}`);
  });

  it('offers only Overview, Engagement and Documents, each under /pn/', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Bear Creek Aggregate' });
    const links = within(strip()).getAllByRole('link');
    // A label may carry its count after it, e.g. "Documents, 1".
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringMatching(/^Overview/),
      expect.stringMatching(/^Engagement/),
      expect.stringMatching(/^Documents/),
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `/pn/${ID}/overview`,
      `/pn/${ID}/engagement`,
      `/pn/${ID}/documents`,
    ]);
  });

  it('draws the open tab body inside the shell', async () => {
    renderPage(`/pn/${ID}/engagement`);

    expect(await screen.findByText('engagement body')).toBeInTheDocument();
    expect(within(strip()).getByRole('link', { name: 'Engagement' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('tells analytics a tab click was on a notification', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Bear Creek Aggregate' });

    await user.click(within(strip()).getByRole('link', { name: /^Engagement/ }));

    expect(track).toHaveBeenCalledWith(
      'Project Tab Clicked',
      expect.objectContaining({
        project_id: ID,
        tab_path: 'engagement',
        record_type: 'notification',
      }),
    );
  });

  it('counts the open period the notification holds on the Engagement tab', async () => {
    // No CommentPeriod record answers, so the count comes from the notification's own dates.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-04-25T19:00:00.000Z'));
    notification = {
      ...NOTIFICATION,
      pcp: 'closed',
      dateStarted: '2025-04-01T19:00:00.000Z',
      dateCompleted: '2025-04-30T19:00:00.000Z',
    };
    renderPage();

    expect(
      // The hidden comma keeps the label and count apart for a screen reader.
      await within(strip()).findByRole('link', { name: 'Engagement, 1 open' }),
    ).toBeInTheDocument();
    // Its periods are filed under its own id; DEMI holds no project to look that id up in.
    expect(requests).toContain(
      `/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=${ID}`,
    );
    expect(requests.filter((url) => url.startsWith('/demi-projects/'))).toEqual([]);
  });

  it('links to the project the notification became', async () => {
    notification = { ...NOTIFICATION, associatedProjectId: 'p-9' };
    renderPage();

    expect(await screen.findByRole('link', { name: 'View project' })).toHaveAttribute(
      'href',
      '/p/p-9',
    );
  });

  it('offers no View project link when the notification has no project', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Bear Creek Aggregate' });
    expect(screen.queryByRole('link', { name: 'View project' })).not.toBeInTheDocument();
  });

  it('shows the loading state until the notification lands', async () => {
    let release: () => void = () => undefined;
    holdNotification = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderPage();

    expect(await screen.findByText('Loading project notification')).toBeInTheDocument();
    expect(screen.queryByText('Bear Creek Aggregate')).not.toBeInTheDocument();

    await act(async () => release());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bear Creek Aggregate' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Loading project notification')).not.toBeInTheDocument();
  });

  it('holds the tab counts back until the notification lands', async () => {
    let release: () => void = () => undefined;
    holdNotification = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderPage();
    await screen.findByText('Loading project notification');

    expect(recordRequests().filter((url) => !url.startsWith('/demi/api/notifications/'))).toEqual(
      [],
    );

    await act(async () => release());

    await waitFor(() =>
      expect(
        requests.some((url) => url.startsWith(DOCUMENT_READ) && url.endsWith(`&project=${ID}`)),
      ).toBe(true),
    );
  });

  it('says the notification was not found when no record has the id', async () => {
    notification = undefined;
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Project notification not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to all project notifications' })).toHaveAttribute(
      'href',
      '/search?record=notifications',
    );
    // With no record, the strip's count searches never go out.
    expect(recordRequests().filter((url) => !url.startsWith('/demi/api/notifications/'))).toEqual(
      [],
    );
  });

  it('says the notification could not be loaded when the search fails', async () => {
    notificationFails = true;
    stubFetch();
    // The app client retries a failed read with backoff; the default test client does not.
    renderAt(`/pn/${ID}/overview`, [
      { path: '/pn/:projId', Component: NotificationPage, children: [{ path: 'overview' }] },
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Could not load project notification' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to all project notifications' })).toHaveAttribute(
      'href',
      '/search?record=notifications',
    );
    expect(
      screen.queryByRole('heading', { name: 'Project notification not found' }),
    ).not.toBeInTheDocument();
  });
});

/** The shipped `/pn/:projId` route, so the redirect under test is the real one. */
const NOTIFICATION_ROUTES = (routes[0].children ?? []).filter(
  (route) => route.path === 'pn/:projId',
) as RouteObject[];

describe('project notification routes', () => {
  it('sends a bare notification URL to Overview', async () => {
    stubFetch();

    const { router } = renderAt(`/pn/${ID}`, NOTIFICATION_ROUTES, { queryClient });

    await waitFor(() => expect(router.state.location.pathname).toBe(`/pn/${ID}/overview`));
  });

  it('hangs the overview links off /pn/, not /p/', async () => {
    stubFetch();

    renderAt(`/pn/${ID}/overview`, NOTIFICATION_ROUTES, { queryClient });

    expect(await screen.findByRole('link', { name: '1 document' })).toHaveAttribute(
      'href',
      `/pn/${ID}/documents`,
    );
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => href.startsWith(`/p/${ID}`))).toEqual([]);
  });

  it('names the document type and milestone from the lists in the Documents table', async () => {
    lists = LISTS;
    documentRow = { ...TYPED_DOCUMENT };
    stubFetch();

    renderAt(`/pn/${ID}/documents`, NOTIFICATION_ROUTES, { queryClient });

    expect(await screen.findByRole('cell', { name: 'Notification Letter' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Notice Received' })).toBeInTheDocument();
    // DEMI files a notification's documents under its own Eagle id; no project lookup goes out.
    expect(requests).toContain(
      `/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted&project=${ID}`,
    );
    expect(requests.filter((url) => url.startsWith('/demi-projects/'))).toEqual([]);
  });

  it('names the featured document type from the lists on Overview', async () => {
    lists = LISTS;
    documentRow = { ...TYPED_DOCUMENT };
    stubFetch();

    renderAt(`/pn/${ID}/overview`, NOTIFICATION_ROUTES, { queryClient });

    expect(
      await screen.findByText('Notification Letter · May 1, 2026 · 2.0 MB'),
    ).toBeInTheDocument();
  });
});
