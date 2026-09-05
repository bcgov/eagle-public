import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Project } from 'app/models/project';
import { fakeMap } from 'app/pages/projects/maplibre-test-stub';
import { DetailsMap } from './details-map';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('app/pages/projects/maplibre-test-stub')).mapLibreStub(),
);

const PROJECT = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  centroid: [-127.5, 54.2],
} as unknown as Project;

/** jsdom never resizes anything, so the spec fires the observer the component registers. */
let resizeContainer: (() => void) | undefined;

class StubResizeObserver {
  constructor(callback: () => void) {
    resizeContainer = callback;
  }
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}

describe('DetailsMap', () => {
  beforeEach(() => {
    fakeMap.reset();
    resizeContainer = undefined;
    vi.stubGlobal('ResizeObserver', StubResizeObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('resizes the map when its container changes size', async () => {
    render(<DetailsMap project={PROJECT} />);
    await screen.findByTestId('map');

    expect(resizeContainer).toBeTypeOf('function');
    expect(fakeMap.resize).not.toHaveBeenCalled();

    resizeContainer!();

    expect(fakeMap.resize).toHaveBeenCalled();
  });
});
