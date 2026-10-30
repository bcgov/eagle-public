import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { track } from 'app/analytics/analytics';
import { loadConfig } from 'app/config/config';
import { queryClient } from 'app/api/query-client';
import { renderAt } from '../../../test-utils';
import { routes } from 'app/routes';
import type { Project } from 'app/models/project';
import { ProjectPage, ProjectShell } from './project';
import { OverviewTab } from './overview-tab';
import { nativeDocument } from 'app/models/demi/document.fixture';
import { native } from '../home/home-fetch.spec-helper';

vi.mock('app/analytics/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/analytics/analytics')>()),
  track: vi.fn(),
}));

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('app/pages/projects/maplibre-test-stub')).mapLibreStub(),
);

const LISTS = [
  { id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { id: 'type-memo-2002', name: 'Scientific Memo', legislation: 2002, type: 'doctype' },
  { id: 'type-memo-2018', name: 'Independent Memo', legislation: 2018, type: 'doctype' },
  { id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { id: 'ms-eac', name: 'EAC Application', legislation: 2018, type: 'label' },
  { id: 'ms-eac-rev', name: 'Revised EAC Application', legislation: 2018, type: 'label' },

  { id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
  { id: 'type-order-2002', name: 'Order', legislation: 2002, type: 'doctype' },
  { id: 'type-order-2018', name: 'Order', legislation: 2018, type: 'doctype' },
  { id: 'type-dm-2002', name: 'Decision Materials', legislation: 2002, type: 'doctype' },
  { id: 'type-dm-2018', name: 'Decision Materials', legislation: 2018, type: 'doctype' },
  { id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },
  { id: 'ms-certdec-2018', name: 'Certificate Decision', legislation: 2018, type: 'label' },
  { id: 'ms-decision-2002', name: 'Decision', legislation: 2002, type: 'label' },
  { id: 'ms-certext-2002', name: 'Certificate Extension', legislation: 2002, type: 'label' },
  { id: 'ms-certext-2018', name: 'Certificate Extension', legislation: 2018, type: 'label' },
  {
    id: 'ms-transfer-2018',
    name: 'Transfer of Certificate/Order',
    legislation: 2018,
    type: 'label',
  },

  { id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { id: 'type-amend-2018', name: 'Amendment Package', legislation: 2018, type: 'doctype' },
  { id: 'type-req-2002', name: 'Request', legislation: 2002, type: 'doctype' },
  { id: 'type-tt-2002', name: 'Tracking Table', legislation: 2002, type: 'doctype' },
  { id: 'type-tt-2018', name: 'Tracking Table', legislation: 2018, type: 'doctype' },
  { id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  { id: 'ms-amend-2018', name: 'Amendment', legislation: 2018, type: 'label' },
  {
    id: 'ph-amend-2002',
    name: 'Post Decision - Amendment',
    legislation: 2002,
    type: 'projectPhase',
  },
  {
    id: 'ph-amend-2018',
    name: 'Post Decision - Amendment',
    legislation: 2018,
    type: 'projectPhase',
  },

  { id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
  { id: 'ms-ce-2018', name: 'Compliance & Enforcement', legislation: 2018, type: 'label' },
];

const DEMI = '/demi-projects';

/** The project as DEMI answers it: Track's field names, the proponent as a bare scalar. */
const PROJECT = {
  // DEMI's own id, the Track one, which it files the project's comment periods under.
  id: '26',
  eagleId: 'proj-1',
  name: 'Cedar Quarry',
  legislation: '2018 Environmental Assessment Act',
  region: 'Skeena',
  address: 'Near Cedar Creek',
  eacDecision: { name: 'In Progress' },
  proponentName: 'Cedar Quarry Partners LP',
  centroid: [],
};

const originalEnv = window.__env;

beforeEach(async () => {
  window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: DEMI };
  await loadConfig();
  // The project document is read through the app's own cache, which outlives one test.
  queryClient.clear();
});

afterEach(() => {
  window.__env = originalEnv;
});

/** Draws proj-1 as the Pacific Link extended page. */
async function pacificLinkEnv() {
  window.__env = {
    logLevel: 4,
    DEMI_PROJECTS_PATH: DEMI,
    EXTENDED_PROJECT_PAGES: { 'proj-1': 'pacific-link' },
  } as unknown as typeof window.__env;
  await loadConfig();
}

/** Each optional document kind's probe, told apart by a list id only its modifiers carry. */
const PROBE_MARKERS = {
  application: 'type-app-2002',
  certificate: 'type-cert-2002',
  amendment: 'type-amend-2002',
  compliance: 'ms-ce-2002',
};

/** A comment period whose window brackets today, so it counts as open. */
function openCommentPeriod() {
  const started = new Date();
  started.setDate(started.getDate() - 2);
  const completed = new Date();
  completed.setDate(completed.getDate() + 5);
  return [
    {
      id: 'cp-1',
      dateStarted: started.toISOString(),
      dateCompleted: completed.toISOString(),
      informationLabel: 'Draft Application',
    },
  ];
}

/** A period that closed last month, so nothing about it is open. */
function closedCommentPeriod() {
  const started = new Date();
  started.setDate(started.getDate() - 60);
  const completed = new Date();
  completed.setDate(completed.getDate() - 30);
  return [
    { id: 'cp-2', dateStarted: started.toISOString(), dateCompleted: completed.toISOString() },
  ];
}

let requests: string[];
let project: Record<string, unknown> | undefined;
let commentPeriods: unknown[];
let updateRows: Record<string, unknown>[];
let documentsTotal: number;
/** DEMI answers the project read with a server error. */
let projectReadFails: boolean;

function visibleUpdates(count: number) {
  return Array.from({ length: count }, (_, index) => ({ _id: `u${index}`, headline: 'Update' }));
}
/** Document kinds this project holds, by probe marker. */
let probeHits: string[];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch() {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('/demi/api/comment-periods')) return native(commentPeriods);
      if (url.startsWith(`${DEMI}/`)) {
        if (projectReadFails) return new Response('', { status: 500 });
        // 404 is how DEMI says it holds no such project.
        return project ? jsonResponse(project) : new Response('{}', { status: 404 });
      }
      if (url.includes('/demi/api/lists')) return native(LISTS);
      if (url.startsWith('/demi/api/updates?')) {
        return native(updateRows.map(({ _id, ...row }) => ({ ...row, id: _id })));
      }
      if (url.startsWith('/demi/api/documents?')) {
        const probe = Object.values(PROBE_MARKERS).find((marker) => url.includes(marker));
        if (probe) {
          return probeHits.includes(probe)
            ? native([nativeDocument({ _id: 'doc-1' })])
            : native([]);
        }
        return native([], documentsTotal);
      }
      return native([]);
    }),
  );
}

function renderShell(path = '/p/proj-1/overview') {
  stubFetch();

  return renderAt(path, [
    {
      path: '/p/:projId',
      Component: ProjectPage,
      children: [
        { path: 'overview', element: <div>tab body</div> },
        { path: 'documents', element: <div>documents body</div> },
        { path: 'updates', element: <div>updates body</div> },
        { path: 'compliance', element: <div>compliance body</div> },
      ],
    },
    { path: '/projects', element: <div>projects page</div> },
  ]).router;
}

function strip(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Project sections' });
}

function tabLabels(): string[] {
  return within(strip())
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

function tabLink(label: string): HTMLElement {
  return within(strip()).getByRole('link', { name: new RegExp(`^${label}`) });
}

describe('project shell', () => {
  beforeEach(() => {
    requests = [];
    project = { ...PROJECT };
    commentPeriods = [];
    updateRows = [];
    documentsTotal = 0;
    probeHits = [];
    projectReadFails = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tells analytics a tab click was on a project', async () => {
    const user = userEvent.setup();
    vi.mocked(track).mockClear();
    renderShell();
    /* No lazy import or timer on this path: the first render in a worker pays jsdom and React
       warm-up, which outlasted the 1 s default under a loaded run. */
    await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' }, { timeout: 4000 });

    await user.click(tabLink('Documents'));

    expect(track).toHaveBeenCalledWith(
      'Project Tab Clicked',
      expect.objectContaining({
        project_id: 'proj-1',
        tab_path: 'documents',
        record_type: 'project',
      }),
    );
  });

  it('renders the always-on tabs, and no Updates, Decisions or Compliance for a project with none', async () => {
    renderShell();

    expect(await screen.findByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/p/proj-1/overview',
    );
    await waitFor(() =>
      expect(tabLabels()).toEqual(['Overview', 'Timeline', 'Engagement', 'Documents']),
    );
    expect(tabLink('Engagement')).toHaveAttribute('href', '/p/proj-1/engagement');
    expect(tabLink('Documents')).toHaveAttribute('href', '/p/proj-1/documents');
  });

  it('keeps the open tab in the strip even when its rule would hide it', async () => {
    renderShell('/p/proj-1/updates');

    await screen.findByText('updates body');
    // Once the empty list lands the rule says hide; only the open route keeps the tab.
    await waitFor(() => expect(tabLink('Updates').querySelector('.tab-count--loading')).toBeNull());
    expect(tabLabels()).toEqual(['Overview', 'Timeline', 'Updates', 'Engagement', 'Documents']);
    expect(tabLink('Updates')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps an open document tab in the strip while its probe says hide', async () => {
    renderShell('/p/proj-1/compliance');

    await screen.findByText('compliance body');
    await waitFor(() =>
      expect(requests.some((url) => url.includes(PROBE_MARKERS.compliance))).toBe(true),
    );
    expect(tabLabels()).toContain('Compliance');
    expect(tabLink('Compliance')).toHaveAttribute('aria-current', 'page');
  });

  it('holds the tab body on the page gutter, with no main landmark of its own', async () => {
    renderShell();

    const body = await screen.findByText('tab body');
    // The app shell owns the one <main>; a second would split the page for screen readers.
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(body.parentElement).toHaveClass('page-container', 'project-page__content');
    // `.tab-content` carries a global `padding: 0` that would strip the gutter.
    expect(body.parentElement).not.toHaveClass('tab-content');
  });

  it('names the strip for screen readers without claiming the ARIA tab pattern', async () => {
    renderShell();

    await screen.findByRole('link', { name: 'Overview' });
    expect(strip()).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(within(strip()).getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-controls',
    );
  });

  it('marks the open tab with aria-current', async () => {
    renderShell('/p/proj-1/documents');

    await waitFor(() => expect(tabLink('Documents')).toHaveAttribute('aria-current', 'page'));
    expect(tabLink('Overview')).not.toHaveAttribute('aria-current');
  });

  it('scrolls the whole strip into view when the route it was sent to has no tab', async () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    stubFetch();
    const { router } = renderAt('/p/proj-1/overview', [
      {
        path: '/p/:projId',
        Component: ProjectPage,
        children: [
          { path: 'overview', element: <div>tab body</div> },
          { path: 'notes', element: <div>notes body</div> },
        ],
      },
    ]);
    await screen.findByText('tab body', {}, { timeout: 4000 });

    await act(() => router.navigate('/p/proj-1/notes', { state: { scrollToTabs: true } }));
    await screen.findByText('notes body');

    expect(within(strip()).queryByRole('link', { current: 'page' })).toBeNull();
    expect(scrolled.mock.contexts).toContain(strip().parentElement);
  });

  it('counts updates, open comment periods and documents beside the labels', async () => {
    updateRows = visibleUpdates(24);
    documentsTotal = 1284;
    commentPeriods = openCommentPeriod();

    renderShell();

    await waitFor(() => expect(tabLink('Updates')).toHaveTextContent('24'));
    expect(tabLink('Documents')).toHaveTextContent('1,284');
    expect(tabLink('Engagement')).toHaveTextContent('1 open');
  });

  it('counts only open comment periods', async () => {
    commentPeriods = closedCommentPeriod();

    renderShell();

    await screen.findByRole('link', { name: 'Overview' });
    await waitFor(() =>
      expect(requests.some((url) => url.includes('/demi/api/comment-periods'))).toBe(true),
    );
    expect(tabLink('Engagement')).toHaveTextContent(/^Engagement$/);
  });

  it('shows Decisions once the project has a decision', async () => {
    project = { ...PROJECT, eacDecision: { name: 'Certificate Issued' } };

    renderShell();

    expect(await within(strip()).findByRole('link', { name: 'Decisions' })).toHaveAttribute(
      'href',
      '/p/proj-1/decisions',
    );
  });

  it('shows Decisions for an undecided project that already has certificate documents', async () => {
    probeHits = [PROBE_MARKERS.certificate];

    renderShell();

    expect(await within(strip()).findByRole('link', { name: 'Decisions' })).toBeInTheDocument();
    expect(within(strip()).queryByRole('link', { name: 'Compliance' })).not.toBeInTheDocument();
  });

  it('shows Compliance only when the project has compliance documents', async () => {
    probeHits = [PROBE_MARKERS.compliance];

    renderShell();

    expect(await within(strip()).findByRole('link', { name: 'Compliance' })).toHaveAttribute(
      'href',
      '/p/proj-1/compliance',
    );
    expect(within(strip()).queryByRole('link', { name: 'Decisions' })).not.toBeInTheDocument();
  });

  it('asks for the strip counts one row at a time', async () => {
    renderShell();

    await waitFor(() =>
      expect(requests.some((url) => url.startsWith('/demi/api/documents?'))).toBe(true),
    );
    const counts = requests.filter((url) => url.startsWith('/demi/api/documents?'));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((url) => url.startsWith('/demi/api/documents?page=1&pageSize=1&'))).toBe(
      true,
    );
  });

  it('heads the page with the project name and the trail that leads to it', async () => {
    renderShell();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' }),
    ).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/search?record=projects',
    );
    expect(within(crumbs).getByText('Cedar Quarry')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the assessment rail in the summary, not in a sidebar', async () => {
    renderShell();

    await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' });
    const summary = screen.getByRole('region', { name: 'Project status' });
    expect(
      within(summary).getByRole('heading', { name: 'Assessment progress' }),
    ).toBeInTheDocument();
    // The fixed sidebar and the Contact Us band both moved out of the shell.
    expect(document.querySelector('.side-banner')).toBeNull();
    expect(document.querySelector('.people')).toBeNull();
  });

  it('pins the project on a map in the band, linked to the map explorer, not in the summary', async () => {
    project = { ...PROJECT, centroid: [-127.5, 54.2] };

    renderShell();

    const title = await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' });
    const band = title.closest('section')!;
    expect(await within(band).findByTestId('marker')).toHaveAttribute('data-lng', '-127.5');
    expect(within(band).getByRole('link', { name: /Open in map explorer/ })).toHaveAttribute(
      'href',
      '/projects?applicant=Cedar+Quarry&selected=proj-1',
    );
    // The panel drew its map inside its own card; the summary has none.
    const summary = screen.getByRole('region', { name: 'Project status' });
    expect(within(summary).queryByTestId('map')).toBeNull();
    expect(screen.getAllByTestId('map')).toHaveLength(1);
  });

  it('leaves the map out of the band, with no placeholder, when the project has no centroid', async () => {
    renderShell();

    await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' });
    expect(screen.queryByText('No map available')).toBeNull();
    expect(screen.queryByRole('link', { name: /Open in map explorer/ })).toBeNull();
  });

  it('keeps the notification panel, with its own map, on a /pn page', async () => {
    stubFetch();
    const notification = {
      _id: 'pn-1',
      name: 'Birch Mine Expansion',
      centroid: [-127.5, 54.2],
      notification: { trigger: 'Threshold' },
    } as unknown as Project;
    renderAt('/pn/pn-1/overview', [
      {
        path: '/pn/:projId',
        element: (
          <ProjectShell
            project={notification}
            projId="pn-1"
            isNotification
            lists={[]}
            tabs={[]}
            isPending={false}
            notFound={false}
          />
        ),
        children: [{ path: 'overview', element: <div>overview body</div> }],
      },
    ]);

    const panel = screen.getByRole('region', { name: 'Project notification summary' });
    expect(await within(panel).findByTestId('map')).toBeInTheDocument();
    expect(screen.getAllByTestId('map')).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Project summary' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Project status' })).toBeNull();
  });

  it('shows a not-found page when the project cannot be loaded', async () => {
    project = undefined;

    renderShell();

    expect(await screen.findByText('Project not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to all projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('keeps an extended page on screen when the project read fails', async () => {
    await pacificLinkEnv();
    projectReadFails = true;

    renderShell();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pacific Link' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(queryClient.getQueryState(['demi-project', 'proj-1'])?.status).toBe('error'),
    );
    // One more turn, so the page's own query settles on the failure and renders.
    await act(async () => undefined);
    expect(screen.queryByText('Project not found')).not.toBeInTheDocument();
    expect(strip()).toBeInTheDocument();
  });
});

/** The real project routes, so the redirects under test are the shipped ones. */
const PROJECT_ROUTES = (routes[0].children ?? []).filter((route) =>
  String(route.path).startsWith('p/:projId'),
) as RouteObject[];

describe('renamed tab paths', () => {
  beforeEach(() => {
    project = { ...PROJECT };
    commentPeriods = [];
    updateRows = [];
    documentsTotal = 0;
    probeHits = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['project-details', 'overview'],
    ['commenting', 'engagement'],
  ])('sends /%s to /%s, keeping the query string', async (from, to) => {
    stubFetch();

    const { router } = renderAt(`/p/proj-1/${from}?search=fish+habitat`, PROJECT_ROUTES);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/p/proj-1/${to}`));
    expect(router.state.location.search).toBe('?search=fish+habitat');
  });

  it('draws the Timeline tab at /timeline on an ordinary project', async () => {
    stubFetch();

    const { router } = renderAt('/p/proj-1/timeline', PROJECT_ROUTES);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Timeline' }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/p/proj-1/timeline');
    expect(tabLink('Timeline')).toHaveAttribute('aria-current', 'page');
  });

  it('sends Pacific Link, which has no Timeline, from /timeline to Overview', async () => {
    await pacificLinkEnv();
    stubFetch();

    const { router } = renderAt('/p/proj-1/timeline', PROJECT_ROUTES);

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/overview'));
    await within(strip()).findByRole('link', { name: /^Overview/ });
    expect(within(strip()).queryByRole('link', { name: /^Timeline/ })).toBeNull();
  });

  it('sends a bare project URL to Overview', async () => {
    stubFetch();

    const { router } = renderAt('/p/proj-1', PROJECT_ROUTES);

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/overview'));
  });
});

/** A fetch stub that records URLs and hands back promises the test resolves when it chooses. */
function deferredFetch() {
  const urls: string[] = [];
  const pending: { url: string; resolve: () => void }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return new Promise<Response>((resolve) => {
        pending.push({
          url,
          resolve: () => {
            if (url.includes('/demi/api/lists')) return resolve(native(LISTS));
            if (url.includes('/demi/api/comment-periods')) return resolve(native([]));
            if (url.startsWith(`${DEMI}/`)) {
              return resolve(jsonResponse(PROJECT));
            }
            resolve(native([]));
          },
        });
      });
    }),
  );
  return {
    urls,
    /** Resolves every request recorded so far, including any queued since the last flush. */
    flush: () => pending.splice(0).forEach((entry) => entry.resolve()),
  };
}

function renderShellWithOverviewTab() {
  return renderAt(
    '/p/proj-1/overview',
    [
      {
        path: '/p/:projId',
        Component: ProjectPage,
        children: [{ path: 'overview', Component: OverviewTab }],
      },
      { path: '/projects', element: <div>projects page</div> },
    ],
    // The app's own client, as main.tsx mounts it: counting requests only means something when the
    // hooks and the plain readers share one cache the way they do in the browser.
    { queryClient },
  );
}

describe('project page first paint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fires every projId-only query before any of them resolves', async () => {
    const fetchStub = deferredFetch();

    renderShellWithOverviewTab();

    // Nothing resolved yet, so each of these came from the project id alone: pins ride the project
    // document, tabs and updates share one read, documents wait on the DEMI id.
    await waitFor(() => expect(fetchStub.urls).toHaveLength(3));
    const issued = fetchStub.urls.join('\n');
    expect(issued).toMatch(/^\/demi-projects\/proj-1$/m);
    expect(issued).toMatch(/^\/demi\/api\/lists\?/m);
    expect(fetchStub.urls.filter((url) => url.startsWith('/demi/api/updates?'))).toHaveLength(1);

    // The comment periods and the documents are filed under DEMI's id, which only the project
    // document carries, and every reader takes it from the one project read.
    fetchStub.flush();
    await waitFor(() =>
      expect(fetchStub.urls).toEqual(
        expect.arrayContaining([
          '/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=26',
          '/demi/api/documents?page=1&pageSize=1&count=true&project=26',
          '/demi/api/documents?page=1&pageSize=5&count=true&sort=-datePosted&isFeatured=true&project=26',
        ]),
      ),
    );
    expect(fetchStub.urls.filter((url) => url.startsWith(`${DEMI}/`))).toHaveLength(1);
  });

  it('renders the project while its banner comment period read is pending, then adds the banner', async () => {
    const urls: string[] = [];
    let releasePeriods = () => undefined as void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/demi/api/comment-periods')) {
          return new Promise<Response>((resolve) => {
            releasePeriods = () => resolve(native(openCommentPeriod()));
          });
        }
        if (url.includes('/demi/api/lists')) return native(LISTS);
        if (url.startsWith(`${DEMI}/`)) return jsonResponse(PROJECT);
        return native([]);
      }),
    );

    renderShellWithOverviewTab();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(urls).toContain('/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=26'),
    );
    expect(screen.queryByRole('heading', { name: 'Public comment period is Open' })).toBeNull();

    act(() => releasePeriods());

    expect(
      await screen.findByRole('heading', { name: 'Public comment period is Open' }),
    ).toBeInTheDocument();
  });

  it('the rail shows its skeleton until the lists arrive', async () => {
    const urls: string[] = [];
    let releaseLists = () => undefined as void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/demi/api/lists')) {
          return new Promise<Response>((resolve) => {
            releaseLists = () => resolve(native(LISTS));
          });
        }
        if (url.startsWith(`${DEMI}/`)) return jsonResponse(PROJECT);
        return native([]);
      }),
    );

    renderShellWithOverviewTab();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' }),
    ).toBeInTheDocument();
    const rail = screen.getByRole('region', { name: 'Assessment progress' });
    expect(within(rail).getByText('Loading assessment progress')).toBeInTheDocument();
    expect(within(rail).queryByText('Post decision')).toBeNull();
    await waitFor(() => expect(urls.some((url) => url.includes('/demi/api/lists'))).toBe(true));

    act(() => releaseLists());

    expect(await within(rail).findByText('Post decision')).toBeInTheDocument();
    expect(within(rail).queryByText('Loading assessment progress')).toBeNull();
  });

  it('shows skeleton placeholders in the hero and the details block, then swaps both for the project', async () => {
    const fetchStub = deferredFetch();

    const { container } = renderShellWithOverviewTab();

    expect(await screen.findByText('Loading project')).toBeInTheDocument();
    expect(screen.getByText('Loading project details')).toBeInTheDocument();
    // Placeholder bars stand in for the hero name and every detail row, and the regions holding
    // them are marked busy.
    expect(container.querySelector('h1 .placeholder')).toBeInTheDocument();
    expect(container.querySelector('.project-masthead[aria-busy="true"]')).toBeInTheDocument();
    expect(
      container.querySelector('.overview-tab__skeleton[aria-busy="true"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('.overview-tab__skeleton .placeholder').length,
    ).toBeGreaterThan(1);
    // Every placeholder sits under an aria-hidden node, so the only thing announced is the
    // visually-hidden loading text.
    for (const bar of container.querySelectorAll('.placeholder')) {
      expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    expect(screen.queryByText('Cedar Quarry')).not.toBeInTheDocument();

    fetchStub.flush();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cedar Quarry'),
    );
    // The banner, the document count, the five tab probes and the featured documents start once
    // the project is in, so wait for all of them before answering.
    await waitFor(() =>
      expect(fetchStub.urls.filter((url) => url.startsWith('/demi/api/documents?'))).toHaveLength(
        7,
      ),
    );
    fetchStub.flush();

    await waitFor(() => expect(screen.queryByText('Loading project')).not.toBeInTheDocument());
    expect(screen.queryByText('Loading project details')).not.toBeInTheDocument();
    expect(container.querySelector('h1 .placeholder')).toBeNull();
    expect(container.querySelector('.overview-tab__skeleton')).toBeNull();
    // The featured documents answer last: their read waits on the DEMI id first.
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
    expect(screen.getByRole('region', { name: 'Project status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About this project' })).toBeInTheDocument();
  });
});
