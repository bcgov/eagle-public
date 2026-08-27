import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { installLeafletStub, stubMarkers } from './leaflet-test-stub';
import { Projects } from './projects';
import { filtersToParams, parseFilters } from './filter-state';
import { projectMatchesFilters } from './project-filter';
import { applistVisible, mapBounds } from 'app/state/map-ui';

const PROJECTS = [
  {
    _id: 'p1',
    name: 'Cedar Quarry',
    client: 'Cedar Holdings',
    type: 'Mines',
    region: 'Skeena',
    description: '<p class="MsoNormal">A quarry near Cedar Creek.</p>',
    centroid: [-127.5, 54.2],
    currentPhaseName: { _id: 'ph1', name: 'Application Review' },
    dateAdded: '2026-01-05T00:00:00.000Z'
  },
  {
    _id: 'p2',
    name: 'Fir Transmission Line',
    client: 'Fir Power',
    type: 'Energy-Electricity',
    region: 'Peace',
    description: 'A transmission line.',
    centroid: [-120.1, 56.4],
    currentPhaseName: { _id: 'ph2', name: 'Pre-Application' },
    dateAdded: '2026-02-05T00:00:00.000Z'
  }
];

const LISTS = [
  { _id: 'r1', type: 'region', name: 'Skeena' },
  { _id: 'r2', type: 'region', name: 'Peace' },
  { _id: 'ph1', type: 'projectPhase', name: 'Application Review', legislation: '2018' },
  { _id: 'ph2', type: 'projectPhase', name: 'Pre-Application', legislation: '2018' }
];

let requests: string[];
let commentPeriodResponders: Map<string, () => Promise<Response>>;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function stubFetch() {
  requests = [];
  commentPeriodResponders = new Map();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('dataset=Project')) {
        return jsonResponse([{ searchResults: PROJECTS, meta: [{ searchResultsTotal: PROJECTS.length }] }]);
      }
      if (url.includes('dataset=List')) {
        return jsonResponse([{ searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] }]);
      }
      if (url.includes('commentperiod')) {
        const projId = new URL(url, 'http://localhost').searchParams.get('project') ?? '';
        const responder = commentPeriodResponders.get(projId);
        return responder ? responder() : jsonResponse([]);
      }
      return jsonResponse([]);
    })
  );
}

function renderAt(path = '/projects') {
  const router = createMemoryRouter([{ path: '/projects', Component: Projects }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return router;
}

/** The popup renders into a detached node that Leaflet owns, so query inside that node. */
function popupContent(markerIndex: number): HTMLElement {
  return stubMarkers[markerIndex].popup.setContent.mock.calls[0][0] as HTMLElement;
}

beforeEach(() => {
  installLeafletStub();
  stubFetch();
  applistVisible.set(false);
  mapBounds.set(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('filter state', () => {
  it('round-trips every filter through the query string', () => {
    const filters = {
      regions: ['r1', 'r2'],
      phases: ['ph1'],
      types: ['mines'],
      applicant: 'cedar',
      clFile: '123',
      dispId: '456',
      purpose: 'quarry',
      publishFrom: new Date('2026-01-01T00:00:00.000Z'),
      publishTo: new Date('2026-06-30T00:00:00.000Z')
    };
    const params = filtersToParams(filters);

    expect(params.toString()).toBe(
      'regions=r1%2Cr2&phases=ph1&types=mines&applicant=cedar&clFile=123&dispId=456&purpose=quarry' +
        '&publishFrom=2026-01-01&publishTo=2026-06-30'
    );
    expect(parseFilters(params)).toEqual(filters);
  });

  it('leaves empty filters out of the query string', () => {
    expect(filtersToParams(parseFilters(new URLSearchParams())).toString()).toBe('');
  });
});

describe('project filter', () => {
  const regions = LISTS.filter(item => item.type === 'region');
  const empty = parseFilters(new URLSearchParams());
  const project = PROJECTS[0] as any;

  it('matches a type filter by the dropdown code, not the raw code string', () => {
    expect(projectMatchesFilters(project, { ...empty, types: ['mines'] }, regions)).toBe(true);
    expect(projectMatchesFilters(project, { ...empty, types: ['transportation'] }, regions)).toBe(false);
  });

  it('matches a region filter by id through the list metadata', () => {
    expect(projectMatchesFilters(project, { ...empty, regions: ['r1'] }, regions)).toBe(true);
    expect(projectMatchesFilters(project, { ...empty, regions: ['r2'] }, regions)).toBe(false);
  });

  it('drops projects outside the publish date range', () => {
    const publishFrom = new Date('2026-02-01T00:00:00.000Z');
    expect(projectMatchesFilters(project, { ...empty, publishFrom }, regions)).toBe(false);
    expect(projectMatchesFilters(PROJECTS[1] as any, { ...empty, publishFrom }, regions)).toBe(true);
  });
});

describe('projects page', () => {
  it('requests every project once and renders a card per result', async () => {
    renderAt();

    // The card shows the phase, not the name: the Project model never populates `client`.
    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(screen.getByText('Pre-Application')).toBeInTheDocument();
    expect(screen.getAllByText('Unknown Client')).toHaveLength(2);
    expect(screen.getByText('2 results on map')).toBeInTheDocument();

    const projectRequests = requests.filter(url => url.includes('dataset=Project'));
    expect(projectRequests).toEqual([
      '/api/search?dataset=Project&pageNum=0&pageSize=1000000&projectLegislation=default&sortBy=&sortBy=&populate=true&fields=&fuzzy=false'
    ]);
  });

  it('links each card to the project details page', async () => {
    renderAt();

    const card = (await screen.findByText('Application Review')).closest('li.app-card') as HTMLElement;
    expect(within(card).getByTitle('Go to project details')).toHaveAttribute('href', '/p/p1');
  });

  it('writes the search box to the URL and narrows the list', async () => {
    const router = renderAt();
    await screen.findByText('Application Review');

    await userEvent.type(screen.getByPlaceholderText('Start typing a project name'), 'fir');

    await waitFor(() => expect(router.state.location.search).toBe('?applicant=fir'));
    expect(screen.getByText('Pre-Application')).toBeInTheDocument();
    expect(screen.queryByText('Application Review')).not.toBeInTheDocument();
    expect(screen.getByText('1 results on map')).toBeInTheDocument();
  });

  it('clears the search filter out of the URL again', async () => {
    const router = renderAt('/projects?applicant=fir');
    await screen.findByText('Pre-Application');

    await userEvent.click(screen.getByLabelText('Clear search'));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('Application Review')).toBeInTheDocument();
  });

  it('applies filters taken from the URL on first load', async () => {
    renderAt('/projects?regions=r2');

    expect(await screen.findByText('Pre-Application')).toBeInTheDocument();
    expect(screen.queryByText('Application Review')).not.toBeInTheDocument();
  });

  it('opens the advanced filters when the URL already carries some', async () => {
    renderAt('/projects?regions=r2');

    expect(await screen.findByText('Hide Advanced Filters')).toBeInTheDocument();
    expect(screen.getByText('Project Phase')).toBeInTheDocument();
  });

  it('shows "No projects found" when nothing matches', async () => {
    renderAt('/projects?applicant=nothing-matches-this');

    expect(await screen.findByText('No projects found')).toBeInTheDocument();
  });
});

describe('project detail popup', () => {
  it('fetches the comment period for the selected marker', async () => {
    commentPeriodResponders.set('p1', async () =>
      jsonResponse([{ _id: 'cp1', dateStarted: '2026-01-01', dateCompleted: '2099-01-01' }])
    );
    renderAt();
    await screen.findByText('Application Review');

    await act(async () => stubMarkers[0].click());

    const popup = popupContent(0);
    expect(await within(popup).findByText('Cedar Quarry')).toBeTruthy();
    // sanitizeWordHtml strips the Word class attribute before the description is rendered.
    expect(popup.innerHTML).toContain('<p>A quarry near Cedar Creek.</p>');
    expect(requests).toContain(
      '/api/commentperiod?project=p1&sortBy=-dateStarted&fields=project|dateStarted|dateCompleted|instructions|isMet|metURL|informationLabel'
    );
  });

  it('ignores the in-flight comment period once another marker is selected', async () => {
    let releaseFirst: (() => void) | undefined;
    commentPeriodResponders.set('p1', async () => {
      await new Promise<void>(resolve => {
        releaseFirst = resolve;
      });
      return jsonResponse([{ _id: 'cp1', dateStarted: '2020-01-01', dateCompleted: '2020-06-01' }]);
    });
    commentPeriodResponders.set('p2', async () =>
      jsonResponse([{ _id: 'cp2', dateStarted: '2026-01-01', dateCompleted: '2099-01-01' }])
    );

    renderAt();
    await screen.findByText('Application Review');

    await act(async () => stubMarkers[0].click());
    await act(async () => stubMarkers[1].click());

    const popup = popupContent(1);
    expect(await within(popup).findByText('Fir Transmission Line')).toBeTruthy();
    expect(await within(popup).findByText('Open')).toBeTruthy();

    // The first project's response lands late; it must not overwrite the second project's status.
    await act(async () => {
      releaseFirst?.();
      await Promise.resolve();
    });
    expect(within(popup).getByText('Open')).toBeTruthy();
    expect(within(popup).queryByText('Closed')).toBeNull();
  });
});
