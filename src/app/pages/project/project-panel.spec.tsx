import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Project } from 'app/models/project';
import { loadConfig } from 'app/config/config';
import { fakeMap } from 'app/pages/projects/maplibre-test-stub';
import { renderAt } from '../../../test-utils';
import { ProjectPanel } from './project-panel';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('app/pages/projects/maplibre-test-stub')).mapLibreStub(),
);

const PROJECT = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  legislation: '2018 Environmental Assessment Act',
  region: 'Skeena',
  location: 'Near Cedar Creek',
  centroid: [-127.5, 54.2],
  eacDecision: { name: 'Certificate issued' },
  decisionDate: '2023-03-14T00:00:00.000Z',
} as unknown as Project;

const FEDERAL = {
  _id: 'bca-1',
  name: 'Coastal Corridor',
  legislation: 'Building Canada Act',
  location: 'Near Prince Rupert',
  centroid: [-130.3, 54.3],
  eacDecision: { name: 'In progress' },
} as unknown as Project;

const NOTIFICATION = {
  _id: 'pn-1',
  name: 'Birch Mine Expansion',
  location: 'Near Birch Lake',
  centroid: [],
  eacDecision: { name: 'Designated' },
  notification: { trigger: 'Threshold' },
} as unknown as Project;

function renderPanel(
  project: Project | null,
  { loading = false, isNotification }: { loading?: boolean; isNotification?: boolean } = {},
) {
  return renderAt('/p/proj-1/overview', [
    {
      path: '/p/:projId/overview',
      element: (
        <ProjectPanel
          project={project}
          lists={[]}
          loading={loading}
          isNotification={isNotification}
        />
      ),
    },
  ]);
}

function factLabels(): string[] {
  return screen.getAllByRole('term').map((term) => term.textContent ?? '');
}

beforeEach(() => fakeMap.reset());

describe('project panel for a project or a notification', () => {
  it('shows the assessment progress rail and an "EA decision" fact for a project', () => {
    renderPanel(PROJECT);

    expect(screen.getByRole('heading', { name: 'Assessment progress' })).toBeInTheDocument();
    expect(factLabels()).toContain('EA decision');
    expect(factLabels()).not.toContain('Decision');
  });

  it('leaves the rail out and labels the fact "Decision" for a notification record', () => {
    renderPanel(NOTIFICATION);

    expect(screen.queryByRole('heading', { name: 'Assessment progress' })).toBeNull();
    expect(factLabels()).toContain('Decision');
    expect(factLabels()).not.toContain('EA decision');
    expect(screen.getByText('Designated')).toBeInTheDocument();
  });

  it('leaves the rail out while a notification route is still loading its record', () => {
    renderPanel(null, { loading: true, isNotification: true });

    expect(screen.getByText('Loading project notification summary')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Assessment progress' })).toBeNull();
    expect(factLabels()).toContain('Decision');
  });

  it('names the panel a project notification summary', () => {
    renderPanel(NOTIFICATION);

    expect(
      screen.getByRole('region', { name: 'Project notification summary' }),
    ).toBeInTheDocument();
  });
});

describe('project panel DEMI reads', () => {
  let requests: string[];

  beforeEach(async () => {
    requests = [];
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '/demi-projects', SEARCH_API_PATH: '/demi' };
    await loadConfig();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requests.push(String(input));
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '' };
    await loadConfig();
  });

  it('asks DEMI about the project beside it, never about the notification', async () => {
    // Mounted together, so the project's read marks the moment the notification's would go too.
    renderAt('/p/proj-1/overview', [
      {
        path: '/p/:projId/overview',
        element: (
          <>
            <ProjectPanel project={PROJECT} lists={[]} />
            <ProjectPanel project={NOTIFICATION} lists={[]} />
          </>
        ),
      },
    ]);

    await waitFor(() => expect(requests).toContain('/demi-projects/proj-1'));
    expect(requests.filter((url) => url.includes('pn-1'))).toEqual([]);
  });

  it('reads no phases for a project under an Act with no stages', async () => {
    // Both panels draw their own facts, so the certificate read is off and only the phase read
    // could ask DEMI. The 2018 project's read marks the moment the other one would go too.
    const ownFacts = { facts: <p>Facts from the page</p> };
    renderAt('/p/proj-1/overview', [
      {
        path: '/p/:projId/overview',
        element: (
          <>
            <ProjectPanel project={PROJECT} lists={[]} parts={ownFacts} />
            <ProjectPanel project={FEDERAL} lists={[]} parts={ownFacts} />
          </>
        ),
      },
    ]);

    await waitFor(() => expect(requests).toContain('/demi-projects/proj-1'));
    expect(requests.filter((url) => url.includes('bca-1'))).toEqual([]);
  });
});

describe('project panel for a project under an Act with no stages', () => {
  it("still draws the page's own progress part", () => {
    renderAt('/p/bca-1/overview', [
      {
        path: '/p/:projId/overview',
        element: (
          <ProjectPanel
            project={FEDERAL}
            lists={[]}
            parts={{ progress: <h2>Corridor review progress</h2> }}
          />
        ),
      },
    ]);

    expect(screen.getByRole('heading', { name: 'Corridor review progress' })).toBeInTheDocument();
  });
});

describe('project panel map', () => {
  it('pins the project at its centroid', async () => {
    renderPanel(PROJECT);

    expect(await screen.findByTestId('map')).toBeInTheDocument();
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lng', '-127.5');
    expect(markers[0]).toHaveAttribute('data-lat', '54.2');
  });

  it('links from the thumbnail to the map explorer, searched for and selecting this project', async () => {
    renderPanel(PROJECT);

    expect(await screen.findByRole('link', { name: /Open in map explorer/ })).toHaveAttribute(
      'href',
      '/projects?applicant=Cedar+Quarry&selected=proj-1',
    );
  });

  it('shows a notification its map but no explorer link, as the explorer lists only projects', async () => {
    renderPanel({ ...NOTIFICATION, centroid: [-127.5, 54.2] } as unknown as Project);

    expect(await screen.findByTestId('map')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open in map explorer/ })).toBeNull();
  });

  it('says so when the project has no centroid', () => {
    renderPanel({ ...PROJECT, centroid: [] } as unknown as Project);

    expect(screen.getByText('No map available')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.queryByRole('link', { name: /Open in map explorer/ })).toBeNull();
    // DEMI is off in this render: the decision date shows with no certificate link or separator.
    expect(screen.getByText('March 14, 2023')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'E23-01' })).toBeNull();
    expect(screen.queryByText('·', { exact: false })).toBeNull();
  });

  it('links the certificate number to the decisions tab once DEMI has one', async () => {
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '/demi-projects' };
    await loadConfig();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('/demi-projects/')
          ? new Response(JSON.stringify({ eaCertificate: 'E23-01' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          : new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    );

    renderPanel(PROJECT);

    const link = await screen.findByRole('link', { name: 'E23-01' });
    expect(link).toHaveAttribute('href', '/p/proj-1/decisions');
    expect(screen.getByText(/March 14, 2023/)).toBeInTheDocument();

    vi.unstubAllGlobals();
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '' };
    await loadConfig();
  });

  it('falls back to the project search hit when DEMI has no record', async () => {
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '/demi-projects', SEARCH_API_PATH: '/demi' };
    await loadConfig();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/demi-projects/')) return new Response('', { status: 404 });
        const body = String(input).includes('/demi/search?dataset=Project')
          ? [{ searchResults: [{ _id: 'proj-1', eaCertificate: 'E23-01' }], meta: [] }]
          : {};
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderPanel(PROJECT);

    expect(await screen.findByRole('link', { name: 'E23-01' })).toHaveAttribute(
      'href',
      '/p/proj-1/decisions',
    );

    vi.unstubAllGlobals();
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '' };
    await loadConfig();
  });
});
