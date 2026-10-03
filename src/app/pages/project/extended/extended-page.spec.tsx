import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { loadConfig, type EnvConfig } from 'app/config/config';
import { queryClient } from 'app/api/query-client';
import { logger } from 'app/config/logging';
import { routes } from 'app/routes';
import { renderAt } from '../../../../test-utils';
import { CORRIDORS } from './fixtures/route-map-stub';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('./fixtures/route-map-stub')).routeMapLibreStub(),
);

vi.mock('app/analytics/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/analytics/analytics')>()),
  track: vi.fn(),
}));

const DEMI = '/demi-projects';
const MPO_PROJECT =
  'https://www.canada.ca/en/privy-council/major-projects-office/projects/national/west.html';
const ALBERTA_PUBLICATION = 'https://open.alberta.ca/publications/west-coast-oil-pipeline-project';
const OTHERS = 'Documents published by others';
const CONTENT_DESCRIPTION =
  'The Government of Alberta proposes an interprovincial pipeline to carry up to one million barrels per day';

/** The project as DEMI answers it. */
const PROJECT = {
  eagleId: 'proj-1',
  name: 'West Coast Oil Pipeline (record name)',
  description: 'Record description that the content replaces.',
  legislation: '2018 Environmental Assessment Act',
  region: 'Lower Mainland',
  eacDecision: { name: 'In Progress' },
  proponentName: 'Government of Alberta',
  centroid: [],
};

const LISTS = [
  { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
];

/** The real project routes, so the shell, tabs and redirects under test are the shipped ones, and a
 * stand-in home page for redirects that leave the project. */
const PROJECT_ROUTES = [
  ...(routes[0].children ?? []).filter((route) => String(route.path).startsWith('p/:projId')),
  { path: '/', element: <p>Home</p> },
] as RouteObject[];

let documentsTotal: number | null;
let corridors: unknown;

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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith(`${DEMI}/`)) return jsonResponse(PROJECT);
      if (url.endsWith('.geojson')) return jsonResponse(corridors);
      if (url.includes('dataset=List')) return jsonResponse(searchResponse(LISTS.length, LISTS));
      if (url.includes('dataset=Document')) {
        // Compliance documents exist, so the EAO page would show its Compliance tab.
        if (url.includes('ms-ce-2002')) return jsonResponse(searchResponse(1, [{ _id: 'd' }]));
        // Null holds the one-row count read open, so the tab sees its count still pending.
        if (documentsTotal === null && /pageSize=1(&|$)/.test(url)) {
          return new Promise<Response>(() => undefined);
        }
        return jsonResponse(searchResponse(documentsTotal ?? 0));
      }
      return jsonResponse(searchResponse(0));
    }),
  );
}

/** Loads the runtime config with `EXTENDED_PROJECT_PAGES` as a config document might hold it. */
async function configure(projects?: unknown) {
  window.__env = {
    logLevel: 4,
    DEMI_PROJECTS_PATH: DEMI,
    ...(projects === undefined ? {} : { EXTENDED_PROJECT_PAGES: projects }),
  } as unknown as EnvConfig;
  await loadConfig();
}

function renderPage(path: string) {
  stubFetch();
  return renderAt(path, PROJECT_ROUTES, { queryClient });
}

function strip(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Project sections' });
}

function tabLink(label: string): HTMLElement {
  return within(strip()).getByRole('link', { name: new RegExp(`^${label}`) });
}

function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Project summary' });
}

const originalEnv = window.__env;

beforeEach(() => {
  documentsTotal = 0;
  corridors = CORRIDORS;
  queryClient.clear();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.__env = originalEnv;
  await loadConfig();
});

describe('extended project page switch', () => {
  it('shows the extended page masthead for a project the config maps to Pacific Link', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    renderPage('/p/proj-1/overview');

    const title = await screen.findByRole('heading', { level: 1, name: 'Pacific Link' });
    const badge = screen.getByText('Project of national interest');
    // After the h1 in reading order, so heading navigation lands on the name first.
    expect(title.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Pacific Link')).toHaveAttribute('aria-current', 'page');
  });

  it('offers the Major Projects Office page in place of the short link', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    renderPage('/p/proj-1/overview');

    const action = await screen.findByRole('link', { name: /^Major Projects Office page/ });
    expect(action).toHaveAttribute('href', MPO_PROJECT);
    expect(action).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('button', { name: 'Short link' })).not.toBeInTheDocument();
  });

  it('offers the Major Projects Office page, then the Government of Alberta page', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    renderPage('/p/proj-1/overview');

    const mpo = await screen.findByRole('link', { name: /^Major Projects Office page/ });
    const alberta = screen.getByRole('link', { name: /^Government of Alberta page/ });
    expect(alberta).toHaveAttribute('href', ALBERTA_PUBLICATION);
    expect(alberta).toHaveAttribute('target', '_blank');
    expect(mpo.compareDocumentPosition(alberta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the EAO page when the config names no extended pages', async () => {
    await configure();

    renderPage('/p/proj-1/overview');

    expect(
      await screen.findByRole('heading', { level: 1, name: PROJECT.name }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Short link' })).toBeInTheDocument();
    expect(screen.queryByText('Project of national interest')).not.toBeInTheDocument();
    expect(
      within(panel()).getByRole('heading', { name: 'Assessment progress' }),
    ).toBeInTheDocument();
  });

  it('keeps the EAO page for a project the map does not name', async () => {
    await configure({ 'proj-9': 'pacific-link' });

    renderPage('/p/proj-1/overview');

    expect(
      await screen.findByRole('heading', { level: 1, name: PROJECT.name }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Project of national interest')).not.toBeInTheDocument();
  });

  it.each<[string, unknown]>([
    ['a bare string', 'pacific-link'],
    ['an array', ['pacific-link']],
    ['an unknown content key', { 'proj-1': 'pacific-lnk' }],
    ['null', null],
  ])('keeps the EAO page and its tabs when the config holds %s', async (_label, projects) => {
    await configure(projects);

    renderPage('/p/proj-1/overview');

    expect(
      await screen.findByRole('heading', { level: 1, name: PROJECT.name }),
    ).toBeInTheDocument();
    expect(await within(strip()).findByRole('link', { name: 'Compliance' })).toBeInTheDocument();
    expect(tabLink('Engagement')).toHaveAttribute('href', '/p/proj-1/engagement');
    expect(
      within(strip()).queryByRole('link', { name: 'Building Canada Act' }),
    ).not.toBeInTheDocument();
  });
});

describe('extended project page tabs and redirects', () => {
  it('shows Overview, Building Canada Act, Review process, Updates and Documents, in that order', async () => {
    await configure({ 'proj-1': 'pacific-link' });
    documentsTotal = 3;

    renderPage('/p/proj-1/overview');

    await waitFor(() => expect(tabLink('Documents')).toHaveTextContent('3'));
    const labels = within(strip())
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(labels).toEqual([
      '/p/proj-1/overview',
      '/p/proj-1/act',
      '/p/proj-1/process',
      '/p/proj-1/updates',
      '/p/proj-1/documents',
    ]);
    expect(tabLink('Building Canada Act')).toBeInTheDocument();
    expect(tabLink('Review process')).toBeInTheDocument();
    expect(tabLink('Updates')).toHaveTextContent('5');
    // Compliance documents exist, but an extended project page has no EAO compliance record.
    expect(within(strip()).queryByRole('link', { name: 'Compliance' })).not.toBeInTheDocument();
  });

  it.each(['engagement', 'decisions', 'compliance'])(
    'sends the EAO-only /%s tab to Overview, keeping the query string and hash',
    async (tab) => {
      await configure({ 'proj-1': 'pacific-link' });

      const { router } = renderPage(`/p/proj-1/${tab}?search=fish#results`);

      await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/overview'));
      expect(router.state.location.search).toBe('?search=fish');
      expect(router.state.location.hash).toBe('#results');
    },
  );

  // A custom tab is unknown to every other project, so it goes where any unknown segment goes.
  it.each(['act', 'process'])('sends /%s to Overview on an ordinary project', async (tab) => {
    await configure();

    const { router } = renderPage(`/p/proj-1/${tab}?search=fish#results`);

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/overview'));
    expect(router.state.location.search).toBe('?search=fish');
    expect(router.state.location.hash).toBe('#results');
  });

  it('sends a segment the extended page has no tab for to Overview', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    const { router } = renderPage('/p/proj-1/timeline');

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/overview'));
  });
  it('leaves the Engagement tab open on an ordinary project', async () => {
    await configure({ 'proj-9': 'pacific-link' });

    const { router } = renderPage('/p/proj-1/engagement');

    await screen.findByRole('heading', { level: 1, name: PROJECT.name });
    expect(router.state.location.pathname).toBe('/p/proj-1/engagement');
  });

  it.each([
    ['act', 'The Building Canada Act'],
    ['process', 'Review process'],
    ['updates', 'Updates'],
  ])('opens the extended page /%s tab under its own heading', async (tab, heading) => {
    await configure({ 'proj-1': 'pacific-link' });

    const { router } = renderPage(`/p/proj-1/${tab}`);

    expect(await screen.findByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/p/proj-1/${tab}`);
  });
});

describe('extended project page progress rail', () => {
  it('says each step state in words and marks only the step in progress as current', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    renderPage('/p/proj-1/overview');

    await screen.findByRole('heading', { level: 1, name: 'Pacific Link' });
    const steps = within(panel()).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual([
      'Referred to Major Projects OfficeComplete · 2 Jul 2026',
      'Listing consultationComplete · Jul – Sep 2026',
      'Canada Gazette noticeComplete · 1 Aug 2026',
      'Listed as national interestComplete · 1 Oct 2026',
      'Federal review and CER hearingsIn progress · Oct 2026 – 2027',
      'Conditions documentUpcoming · Target 1 Sep 2027',
    ]);
    const current = steps.filter((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Federal review and CER hearings');
  });

  it('marks the same step current on the Review process timeline', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    renderPage('/p/proj-1/process');

    const timeline = await screen.findByRole('region', { name: 'Federal review timeline' });
    const current = within(timeline)
      .getAllByRole('listitem')
      .filter((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(within(current[0]!).getByRole('heading', { level: 4 })).toHaveTextContent(
      'Federal review and CER hearings',
    );
    expect(current[0]).toHaveTextContent('In progress · Oct 2026 – 2027');
  });
});

describe('extended page Overview', () => {
  it('describes the project from the content, not the record', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    renderPage('/p/proj-1/overview');

    expect(await screen.findByText(new RegExp(`^${CONTENT_DESCRIPTION}`))).toBeInTheDocument();
    expect(screen.queryByText(PROJECT.description)).not.toBeInTheDocument();
  });

  it('keeps the rest of Overview when the route map fails to draw', async () => {
    await configure({ 'proj-1': 'pacific-link' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    // Not a FeatureCollection: framing it throws inside the map.
    corridors = { type: 'Feature' };

    renderPage('/p/proj-1/overview');

    // The route map and the panel thumbnail both say so.
    expect(await screen.findAllByText('The map could not be loaded.')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Ownership' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pacific Link' })).toBeInTheDocument();
  });
});

describe('extended page Documents tab', () => {
  it('points elsewhere for the records when the project has no documents', async () => {
    await configure({ 'proj-1': 'pacific-link' });
    documentsTotal = 0;

    renderPage('/p/proj-1/documents');

    expect(
      await screen.findByRole('heading', { name: 'No documents on EPIC yet' }),
    ).toBeInTheDocument();
  });

  it('shows the usual documents view once the project has documents', async () => {
    await configure({ 'proj-1': 'pacific-link' });
    documentsTotal = 12;

    renderPage('/p/proj-1/documents');

    expect(await screen.findByRole('link', { name: 'All Documents' })).toBeInTheDocument();
    await waitFor(() => expect(tabLink('Documents')).toHaveTextContent('12'));
    expect(
      screen.queryByRole('heading', { name: 'No documents on EPIC yet' }),
    ).not.toBeInTheDocument();
  });

  it('waits for the count before calling the project empty', async () => {
    await configure({ 'proj-1': 'pacific-link' });
    documentsTotal = null;

    renderPage('/p/proj-1/documents');

    expect(await screen.findByRole('link', { name: 'All Documents' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No documents on EPIC yet' }),
    ).not.toBeInTheDocument();
  });

  it('shows the usual documents view for an ordinary project with no documents', async () => {
    await configure();
    documentsTotal = 0;

    renderPage('/p/proj-1/documents');

    expect(await screen.findByRole('link', { name: 'All Documents' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No documents on EPIC yet' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: OTHERS })).not.toBeInTheDocument();
  });

  it('lists the documents others published below the empty notice', async () => {
    await configure({ 'proj-1': 'pacific-link' });
    documentsTotal = 0;

    renderPage('/p/proj-1/documents');

    const empty = await screen.findByRole('heading', { name: 'No documents on EPIC yet' });
    const others = screen.getByRole('region', { name: OTHERS });
    expect(empty.compareDocumentPosition(others) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const links = within(others).getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links.filter((link) => link.getAttribute('href')?.startsWith('https://'))).toHaveLength(
      5,
    );
  });

  it('lists the documents others published below the EPIC documents', async () => {
    await configure({ 'proj-1': 'pacific-link' });
    documentsTotal = 12;

    renderPage('/p/proj-1/documents');

    const epic = await screen.findByRole('link', { name: 'All Documents' });
    const others = screen.getByRole('region', { name: OTHERS });
    expect(epic.compareDocumentPosition(others) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(others).getAllByRole('link')).toHaveLength(5);
  });
});

describe('focus after an in-page link', () => {
  it('moves focus to the Act tab heading from "How the Act works"', async () => {
    const user = userEvent.setup();
    await configure({ 'proj-1': 'pacific-link' });

    const { router } = renderPage('/p/proj-1/overview');
    await user.click(await screen.findByRole('link', { name: /^How the Act works/ }));
    // The Act tab's route has a loader, so the Overview band (same heading) stays until it answers.
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/act'));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 2, name: 'The Building Canada Act' }),
      ).toHaveFocus(),
    );
  });

  it('moves focus to the Updates tab heading from "See all"', async () => {
    const user = userEvent.setup();
    await configure({ 'proj-1': 'pacific-link' });

    renderPage('/p/proj-1/overview');
    // jsdom's name computation drops the space before the visually hidden " updates".
    await user.click(await screen.findByRole('link', { name: /^See all 5\s?updates$/ }));

    const heading = await screen.findByRole('heading', { level: 2, name: 'Updates' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('leaves focus alone when the tab opens from the strip', async () => {
    const user = userEvent.setup();
    await configure({ 'proj-1': 'pacific-link' });

    const { router } = renderPage('/p/proj-1/overview');
    await screen.findByRole('heading', { level: 1, name: 'Pacific Link' });
    await user.click(tabLink('Building Canada Act'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/act'));

    // One heading by that name once the band has gone with Overview.
    await waitFor(() =>
      expect(
        screen.getAllByRole('heading', { level: 2, name: 'The Building Canada Act' }),
      ).toHaveLength(1),
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'The Building Canada Act' }),
    ).not.toHaveFocus();
  });
});
