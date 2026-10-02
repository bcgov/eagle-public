import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { extendedPageKey, loadConfig, type EnvConfig } from 'app/config/config';
import { queryClient } from 'app/api/query-client';
import { logger } from 'app/config/logging';
import { routes } from 'app/routes';
import { renderAt } from '../../../../test-utils';
import { ORDINARY_PAGE } from './fixtures/ordinary-page';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('./fixtures/route-map-stub')).routeMapLibreStub(),
);

vi.mock('app/analytics/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/analytics/analytics')>()),
  track: vi.fn(),
}));

// The fixture is registered under its own key beside the shipped content, so the real switch
// (EXTENDED_PROJECT_PAGES, read through extendedPageKey) still decides which project gets it.
vi.mock('./extended-page', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./extended-page')>();
  return {
    ...actual,
    extendedPageFor: (projId: string) =>
      extendedPageKey(projId) === 'ordinary' ? ORDINARY_PAGE : actual.extendedPageFor(projId),
  };
});

const DEMI = '/demi-projects';

/** An ordinary project under the 2018 Act, as DEMI answers it. */
const PROJECT = {
  eagleId: 'proj-2',
  name: 'Larch Creek Mine',
  description: 'An open pit copper mine near Larch Creek.',
  legislation: '2018 Environmental Assessment Act',
  location: 'Near Larch Creek',
  region: 'Skeena',
  eacDecision: { name: 'In Progress' },
  proponentName: 'Larch Creek Mining Ltd.',
  centroid: [-127.5, 54.2],
};

const LISTS = [
  { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
];

const PROJECT_ROUTES = [
  ...(routes[0].children ?? []).filter((route) => String(route.path).startsWith('p/:projId')),
  { path: '/', element: <p>Home</p> },
] as RouteObject[];

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
      if (url.includes('dataset=List')) return jsonResponse(searchResponse(LISTS.length, LISTS));
      if (url.includes('dataset=Document')) {
        // Compliance documents exist, so the standard strip shows its Compliance tab.
        if (url.includes('ms-ce-2002')) return jsonResponse(searchResponse(1, [{ _id: 'd' }]));
        return jsonResponse(searchResponse(2));
      }
      return jsonResponse(searchResponse(0));
    }),
  );
}

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

function stripHrefs(): (string | null)[] {
  return within(strip())
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
}

function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Project summary' });
}

function precedes(first: Node, second: Node): boolean {
  return !!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

const originalEnv = window.__env;

beforeEach(() => {
  queryClient.clear();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.__env = originalEnv;
  await loadConfig();
});

describe('an ordinary EAO project with an extended page', () => {
  beforeEach(() => configure({ 'proj-2': 'ordinary' }));

  it('keeps the standard masthead with its short link', async () => {
    renderPage('/p/proj-2/overview');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Larch Creek Mine' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Short link' })).toBeInTheDocument();
  });

  it('keeps the assessment rail, the record facts and the location map', async () => {
    renderPage('/p/proj-2/overview');

    await screen.findByRole('heading', { level: 1, name: 'Larch Creek Mine' });
    expect(
      within(panel()).getByRole('heading', { name: 'Assessment progress' }),
    ).toBeInTheDocument();
    expect(
      within(panel())
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Status', 'EA decision', 'Type', 'Location', 'Proponent']);
    expect(within(panel()).getByRole('link', { name: /Open in map explorer/ })).toBeInTheDocument();
  });

  it('draws the Overview banner between the tab strip and the Overview', async () => {
    renderPage('/p/proj-2/overview');

    const band = await screen.findByRole('heading', {
      level: 2,
      name: 'Larch Creek community fund',
    });
    const about = await screen.findByRole('heading', { level: 2, name: 'About this project' });
    expect(precedes(strip(), band)).toBe(true);
    expect(precedes(band, about)).toBe(true);
  });

  it('appends its main blocks after the details panel and its aside blocks after the contact card', async () => {
    renderPage('/p/proj-2/overview');

    const about = await screen.findByRole('heading', { level: 2, name: 'About this project' });
    const water = screen.getByRole('heading', { level: 2, name: 'Water monitoring' });
    expect(precedes(about, water)).toBe(true);
    expect(screen.getByText('Three stations sample Larch Creek each month.')).toBeInTheDocument();

    const aside = screen.getByRole('complementary');
    expect(within(aside).queryByRole('heading', { name: 'Water monitoring' })).toBeNull();
    const contact = within(aside).getByRole('heading', { level: 2, name: 'Contact' });
    const town = within(aside).getByRole('heading', { level: 2, name: 'Town pages' });
    expect(precedes(contact, town)).toBe(true);
    expect(within(aside).getByRole('link', { name: /^Larch Creek council/ })).toHaveAttribute(
      'href',
      'https://larch-creek.example/council',
    );
  });

  it('lists its tabs in the order the page gives, leaving out the empty Updates tab', async () => {
    renderPage('/p/proj-2/overview');

    await waitFor(() =>
      expect(stripHrefs()).toEqual([
        '/p/proj-2/overview',
        '/p/proj-2/community',
        '/p/proj-2/engagement',
        '/p/proj-2/documents',
      ]),
    );
  });

  it('opens its own tab from the strip', async () => {
    const user = userEvent.setup();
    const { router } = renderPage('/p/proj-2/overview');

    await user.click(await within(strip()).findByRole('link', { name: 'Community fund' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'How the community fund works' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Fund rules' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/p/proj-2/community');
  });

  it('sends a deeper path under its own tab to Overview', async () => {
    const { router } = renderPage('/p/proj-2/community/rules');

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-2/overview'));
  });

  it('sends a segment the page has no tab for to Overview, keeping the query string and hash', async () => {
    const { router } = renderPage('/p/proj-2/nowhere?search=fish#results');

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-2/overview'));
    expect(router.state.location.search).toBe('?search=fish');
    expect(router.state.location.hash).toBe('#results');
  });

  it('leaves the Compliance tab out of the strip and sends /compliance to Overview', async () => {
    const { router } = renderPage('/p/proj-2/compliance');

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-2/overview'));
    await screen.findByRole('heading', { level: 2, name: 'About this project' });
    await waitFor(() => expect(stripHrefs()).toContain('/p/proj-2/documents'));
    expect(stripHrefs()).not.toContain('/p/proj-2/compliance');
  });
});

describe('an ordinary EAO project the switch does not name', () => {
  beforeEach(() => configure({ 'proj-9': 'ordinary' }));

  it('is the standard page: standard tabs, no appended blocks, no own tab', async () => {
    renderPage('/p/proj-2/overview');

    await screen.findByRole('heading', { level: 2, name: 'About this project' });
    await waitFor(() => expect(stripHrefs()).toContain('/p/proj-2/compliance'));
    expect(stripHrefs()).not.toContain('/p/proj-2/community');
    expect(screen.getByRole('button', { name: 'Short link' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Larch Creek community fund' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Water monitoring' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Town pages' })).toBeNull();
  });

  it('sends the page-only segment to Overview', async () => {
    const { router } = renderPage('/p/proj-2/community');

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-2/overview'));
  });

  it('makes the same requests as with the switch unset: no map data, nothing extra', async () => {
    async function requestsFor(projects?: unknown): Promise<string[]> {
      await configure(projects);
      queryClient.clear();
      renderPage('/p/proj-2/overview');
      await screen.findByRole('heading', { level: 2, name: 'About this project' });
      await waitFor(() => expect(stripHrefs()).toContain('/p/proj-2/compliance'));
      const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
      cleanup();
      return [...new Set(urls)].sort();
    }

    const withSwitch = await requestsFor({ 'proj-9': 'ordinary' });
    const withoutSwitch = await requestsFor();

    expect(withSwitch).toEqual(withoutSwitch);
    expect(withSwitch.filter((url) => url.includes('geojson'))).toEqual([]);
  });
});
