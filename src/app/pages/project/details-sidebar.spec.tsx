import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Project } from 'app/models/project';
import { fakeMap } from 'app/pages/projects/maplibre-test-stub';
import { DetailsSidebar } from './details-sidebar';

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

function renderSidebar(project: Project | null) {
  return render(<DetailsSidebar project={project} open onToggle={() => undefined} />);
}

beforeEach(() => fakeMap.reset());

describe('project details sidebar map', () => {
  it('pins the project at its centroid', async () => {
    renderSidebar(PROJECT);

    expect(await screen.findByTestId('map')).toBeInTheDocument();
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lng', '-127.5');
    expect(markers[0]).toHaveAttribute('data-lat', '54.2');
  });

  it('recentres on the project when the view is reset', async () => {
    renderSidebar(PROJECT);

    await userEvent.click(await screen.findByRole('button', { name: 'Reset view' }));

    expect(fakeMap.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-127.5, 54.2], zoom: 8 }),
    );
  });

  it('says so when the project has no centroid', () => {
    renderSidebar({ ...PROJECT, centroid: [] } as unknown as Project);

    expect(screen.getByText('No map available')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).toBeNull();
  });
});
