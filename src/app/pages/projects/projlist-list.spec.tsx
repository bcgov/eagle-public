import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Project } from 'app/models/project';
import { ProjlistList } from './projlist-list';

function renderList(projects: Project[] | null, loading: boolean) {
  render(
    <ProjlistList
      projects={projects}
      loading={loading}
      selectedId={null}
      hoveredId={null}
      onSelect={vi.fn()}
      onHover={vi.fn()}
      mobile={false}
      engagementById={undefined}
      status="Sorted by name"
    />,
  );
  return screen.getByTestId('results-count');
}

describe('ProjlistList result count', () => {
  it('reads only the status while loading, with no stray separator before it', () => {
    expect(renderList(null, true)).toHaveTextContent(/^Sorted by name$/);
  });

  it('reads the count, then the status', () => {
    const projects = [
      { _id: 'a', name: 'Alder Mine', centroid: [-123, 49] },
      { _id: 'b', name: 'Birch Dam', centroid: [-124, 50] },
    ] as Project[];

    expect(renderList(projects, false)).toHaveTextContent(/^2 projects in view\. Sorted by name$/);
  });
});
