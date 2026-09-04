import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { RouteObject } from 'react-router';
import { renderAt } from '../../../test-utils';
import { routes } from 'app/routes';
import { ProjectPage } from './project';
import { ProjectDetailsTab } from './project-details-tab';

const LISTS = [
  { _id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { _id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { _id: 'type-memo-2002', name: 'Scientific Memo', legislation: 2002, type: 'doctype' },
  { _id: 'type-memo-2018', name: 'Independent Memo', legislation: 2018, type: 'doctype' },
  { _id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { _id: 'ms-eac', name: 'EAC Application', legislation: 2018, type: 'label' },
  { _id: 'ms-eac-rev', name: 'Revised EAC Application', legislation: 2018, type: 'label' },

  { _id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { _id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
  { _id: 'type-order-2002', name: 'Order', legislation: 2002, type: 'doctype' },
  { _id: 'type-order-2018', name: 'Order', legislation: 2018, type: 'doctype' },
  { _id: 'type-dm-2002', name: 'Decision Materials', legislation: 2002, type: 'doctype' },
  { _id: 'type-dm-2018', name: 'Decision Materials', legislation: 2018, type: 'doctype' },
  { _id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },
  { _id: 'ms-certdec-2018', name: 'Certificate Decision', legislation: 2018, type: 'label' },
  { _id: 'ms-decision-2002', name: 'Decision', legislation: 2002, type: 'label' },
  { _id: 'ms-certext-2002', name: 'Certificate Extension', legislation: 2002, type: 'label' },
  { _id: 'ms-certext-2018', name: 'Certificate Extension', legislation: 2018, type: 'label' },
  {
    _id: 'ms-transfer-2018',
    name: 'Transfer of Certificate/Order',
    legislation: 2018,
    type: 'label',
  },

  { _id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { _id: 'type-amend-2018', name: 'Amendment Package', legislation: 2018, type: 'doctype' },
  { _id: 'type-req-2002', name: 'Request', legislation: 2002, type: 'doctype' },
  { _id: 'type-tt-2002', name: 'Tracking Table', legislation: 2002, type: 'doctype' },
  { _id: 'type-tt-2018', name: 'Tracking Table', legislation: 2018, type: 'doctype' },
  { _id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  { _id: 'ms-amend-2018', name: 'Amendment', legislation: 2018, type: 'label' },
  {
    _id: 'ph-amend-2002',
    name: 'Post Decision - Amendment',
    legislation: 2002,
    type: 'projectPhase',
  },
  {
    _id: 'ph-amend-2018',
    name: 'Post Decision - Amendment',
    legislation: 2018,
    type: 'projectPhase',
  },

  { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
  { _id: 'ms-ce-2018', name: 'Compliance & Enforcement', legislation: 2018, type: 'label' },
];

const PROJECT = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  legislation: '2018 Environmental Assessment Act',
  region: 'Skeena',
  location: 'Near Cedar Creek',
  eacDecision: { name: 'In Progress' },
  proponent: { name: 'Cedar Quarry Partners LP' },
  centroid: [],
  commentPeriodForBanner: [],
};

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
      _id: 'cp-1',
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
    { _id: 'cp-2', dateStarted: started.toISOString(), dateCompleted: completed.toISOString() },
  ];
}

let requests: string[];
let project: Record<string, unknown> | undefined;
let commentPeriods: unknown[];
let updatesTotal: number;
let documentsTotal: number;
/** Document kinds this project holds, by probe marker. */
let probeHits: string[];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function searchResponse(total: number, results: unknown[] = []) {
  return [{ searchResults: results, meta: [{ searchResultsTotal: total }] }];
}

function stubFetch() {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('/commentperiod?')) {
        return jsonResponse(commentPeriods);
      }
      if (url.startsWith('/api/project/')) {
        return jsonResponse(project ? [project] : []);
      }
      if (url.includes('dataset=List')) {
        return jsonResponse(searchResponse(LISTS.length, LISTS));
      }
      if (url.includes('dataset=RecentActivity')) {
        return jsonResponse(searchResponse(updatesTotal));
      }
      if (url.includes('dataset=Document')) {
        const probe = Object.values(PROBE_MARKERS).find((marker) => url.includes(marker));
        if (probe) {
          return jsonResponse(
            searchResponse(1, probeHits.includes(probe) ? [{ _id: 'doc-1' }] : []),
          );
        }
        return jsonResponse(searchResponse(documentsTotal));
      }
      return jsonResponse(searchResponse(0));
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
    updatesTotal = 0;
    documentsTotal = 0;
    probeHits = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the always-on tabs, and no Decisions or Compliance for a project with neither', async () => {
    renderShell();

    expect(await screen.findByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/p/proj-1/overview',
    );
    await waitFor(() =>
      expect(tabLabels()).toEqual(['Overview', 'Updates', 'Engagement', 'Documents']),
    );
    expect(tabLink('Engagement')).toHaveAttribute('href', '/p/proj-1/engagement');
    expect(tabLink('Documents')).toHaveAttribute('href', '/p/proj-1/documents');
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

  it('still carries the ENGAGE banner, image and outbound link, for a hosted engagement', async () => {
    const [period] = openCommentPeriod();
    project = {
      ...PROJECT,
      commentPeriodForBanner: [
        {
          ...period,
          isMet: true,
          metURL: 'https://engage.example/cedar',
          metBannerImageUrl: 'https://engage.example/banner.jpg',
        },
      ],
    };

    renderShell();

    expect(await screen.findByRole('link', { name: /Share your thoughts/ })).toHaveAttribute(
      'href',
      'https://engage.example/cedar',
    );
    expect(screen.getByAltText('Engagement banner')).toHaveAttribute(
      'src',
      'https://engage.example/banner.jpg',
    );
  });

  it('marks the open tab with aria-current', async () => {
    renderShell('/p/proj-1/documents');

    await waitFor(() => expect(tabLink('Documents')).toHaveAttribute('aria-current', 'page'));
    expect(tabLink('Overview')).not.toHaveAttribute('aria-current');
  });

  it('counts updates, open comment periods and documents beside the labels', async () => {
    updatesTotal = 24;
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
    await waitFor(() => expect(requests.some((url) => url.includes('/commentperiod?'))).toBe(true));
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
      expect(requests.some((url) => url.includes('dataset=Document'))).toBe(true),
    );
    const counts = requests.filter(
      (url) => url.includes('dataset=Document') || url.includes('dataset=RecentActivity'),
    );
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((url) => url.includes('pageSize=1'))).toBe(true);
  });

  it('heads the page with the project name and the trail that leads to it', async () => {
    renderShell();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' }),
    ).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(within(crumbs).getByText('Cedar Quarry')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the project facts and the assessment rail in the panel, not in a sidebar', async () => {
    project = { ...PROJECT, currentPhaseName: { name: 'Effects Assessment' } };

    renderShell();

    await screen.findByRole('heading', { level: 1, name: 'Cedar Quarry' });
    const panel = screen.getByRole('region', { name: 'Project summary' });
    expect(within(panel).getByRole('heading', { name: 'Assessment progress' })).toBeInTheDocument();
    for (const [label, value] of [
      ['Status', 'Effects Assessment'],
      ['EA decision', 'In Progress'],
      ['Location', 'Near Cedar Creek'],
      ['Proponent', 'Cedar Quarry Partners LP'],
    ]) {
      const term = within(panel).getByText(label, { selector: 'dt' });
      expect(term.nextElementSibling).toHaveTextContent(value);
    }
    // The fixed sidebar and the Contact Us band both moved out of the shell.
    expect(document.querySelector('.side-banner')).toBeNull();
    expect(document.querySelector('.people')).toBeNull();
  });

  it('renders the map placeholder when the project has no centroid', async () => {
    renderShell();

    expect(await screen.findByText('No map available')).toBeInTheDocument();
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
});

/** The real project routes, so the redirects under test are the shipped ones. */
const PROJECT_ROUTES = (routes[0].children ?? []).filter((route) =>
  String(route.path).startsWith('p/:projId'),
) as RouteObject[];

describe('renamed tab paths', () => {
  beforeEach(() => {
    project = { ...PROJECT };
    commentPeriods = [];
    updatesTotal = 0;
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
            if (url.includes('dataset=List')) {
              return resolve(
                jsonResponse([
                  { searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] },
                ]),
              );
            }
            if (url.includes('/commentperiod?')) {
              return resolve(jsonResponse([]));
            }
            if (url.startsWith('/api/project/') && !url.includes('/pin')) {
              return resolve(jsonResponse([PROJECT]));
            }
            if (url.includes('/pin')) {
              return resolve(jsonResponse([{ results: [], total_items: 0 }]));
            }
            resolve(jsonResponse([{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }]));
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
  return renderAt('/p/proj-1/overview', [
    {
      path: '/p/:projId',
      Component: ProjectPage,
      children: [{ path: 'overview', Component: ProjectDetailsTab }],
    },
    { path: '/projects', element: <div>projects page</div> },
  ]);
}

describe('project page first paint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fires every projId-only query before any of them resolves', async () => {
    const fetchStub = deferredFetch();

    renderShellWithOverviewTab();

    // Nothing has been resolved, so anything in this list was issued from the project id alone
    // rather than from another request's answer.
    await waitFor(() => expect(fetchStub.urls).toHaveLength(8));
    const issued = fetchStub.urls.join('\n');
    expect(issued).toMatch(/^\/api\/project\/proj-1\?/m);
    expect(issued).toMatch(/^\/api\/project\/proj-1\/pin\?/m);
    expect(issued).toMatch(/\/commentperiod\?project=proj-1/);
    expect(issued).toMatch(/dataset=List/);
    expect(issued).toMatch(/dataset=RecentActivity.*pageSize=1/);
    expect(issued).toMatch(/dataset=RecentActivity.*pageSize=10/);
    expect(issued).toMatch(/dataset=Document.*pageSize=1/);
    expect(issued).toMatch(/dataset=Document.*pageSize=5/);
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
    expect(container.querySelector('.location-info[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('.location-info .placeholder').length).toBeGreaterThan(1);
    // Every placeholder sits under an aria-hidden node, so the only thing announced is the
    // visually-hidden loading text.
    for (const bar of container.querySelectorAll('.placeholder')) {
      expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    expect(screen.queryByText('Cedar Quarry')).not.toBeInTheDocument();

    fetchStub.flush();
    // The tab probes and the featured-document search start after the first flush.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cedar Quarry'),
    );
    fetchStub.flush();

    await waitFor(() => expect(screen.queryByText('Loading project')).not.toBeInTheDocument());
    expect(screen.queryByText('Loading project details')).not.toBeInTheDocument();
    expect(container.querySelector('h1 .placeholder')).toBeNull();
    expect(container.querySelector('.location-info .placeholder')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    // Once in the panel, once in the tab body below it.
    expect(screen.getAllByText('Proponent')).toHaveLength(2);
  });
});
