import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { Project } from 'app/models/project';
import { renderAt } from '../../../test-utils';
import { ProjectLocationMap } from './project-location-map';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('app/pages/projects/maplibre-test-stub')).mapLibreStub(),
);

const PROJECT = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  centroid: [-127.5, 54.2],
} as unknown as Project;

function renderMap(
  project: Project | null,
  props: { loading?: boolean; notification?: boolean } = {},
) {
  return renderAt('/p/proj-1/overview', [
    {
      path: '/p/:projId/overview',
      element: <ProjectLocationMap project={project} {...props} />,
    },
  ]);
}

describe('project location map', () => {
  it('pins the project at its centroid', async () => {
    renderMap(PROJECT);

    expect(await screen.findByTestId('map')).toBeInTheDocument();
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lng', '-127.5');
    expect(markers[0]).toHaveAttribute('data-lat', '54.2');
  });

  it('links to the map explorer, searched for and selecting this project', () => {
    renderMap(PROJECT);

    expect(screen.getByRole('link', { name: /Open in map explorer/ })).toHaveAttribute(
      'href',
      '/projects?applicant=Cedar+Quarry&selected=proj-1',
    );
  });

  it('gives a notification its map but no explorer link, as the explorer lists only projects', async () => {
    renderMap(PROJECT, { notification: true });

    expect(await screen.findByTestId('map')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open in map explorer/ })).toBeNull();
  });

  it('says so when the project has no centroid, with no map and no link', () => {
    renderMap({ ...PROJECT, centroid: [] } as unknown as Project);

    expect(screen.getByText('No map available')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.queryByRole('link', { name: /Open in map explorer/ })).toBeNull();
  });

  it('holds a placeholder, not "No map available", while the project loads', () => {
    renderMap(null, { loading: true });

    expect(screen.queryByText('No map available')).toBeNull();
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.queryByRole('link', { name: /Open in map explorer/ })).toBeNull();
  });
});
