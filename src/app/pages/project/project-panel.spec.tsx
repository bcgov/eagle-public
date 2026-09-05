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
    // DEMI is off in this render, so the fact never appears.
    expect(screen.queryByText('EA Certificate')).toBeNull();
  });

  it('names the EA Certificate once DEMI has one', async () => {
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

    expect(await screen.findByText('EA Certificate')).toBeInTheDocument();
    expect(screen.getByText('E23-01')).toBeInTheDocument();

    vi.unstubAllGlobals();
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '' };
    await loadConfig();
  });
});
