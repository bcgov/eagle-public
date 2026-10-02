import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { stubIntersection } from './intersection.spec-helper';
import { useNearViewport } from './use-near-viewport';

function renderNear() {
  const ref = { current: document.createElement('section') };
  return renderHook(() => useNearViewport(ref, '200px'));
}

describe('useNearViewport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stops watching when it unmounts before the element comes near', () => {
    const { disconnect } = stubIntersection();
    const { result, unmount } = renderNear();
    expect(result.current).toBe(false);
    expect(disconnect).not.toHaveBeenCalled();

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});
