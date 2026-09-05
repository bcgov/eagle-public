import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
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

function renderPanel(project: Project | null) {
  return renderAt('/p/proj-1/overview', [
    {
      path: '/p/:projId/overview',
      element: <ProjectPanel project={project} lists={[]} loading={false} />,
    },
  ]);
}

beforeEach(() => fakeMap.reset());

describe('project panel map', () => {
  it('pins the project at its centroid', async () => {
    renderPanel(PROJECT);

    expect(await screen.findByTestId('map')).toBeInTheDocument();
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lng', '-127.5');
    expect(markers[0]).toHaveAttribute('data-lat', '54.2');
  });

  it('links from the thumbnail to the map explorer', async () => {
    renderPanel(PROJECT);

    expect(await screen.findByRole('link', { name: /Open in map explorer/ })).toHaveAttribute(
      'href',
      '/projects',
    );
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
