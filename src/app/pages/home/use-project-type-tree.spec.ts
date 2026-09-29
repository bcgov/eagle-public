import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { makeQueryClient } from '../../../test-utils';
import { envelope, json, PENDING, stubFetch } from './home-fetch.spec-helper';
import { useProjectTypeTree } from './use-project-type-tree';

const project = (_id: string, type: string, sector: string) => ({
  _id,
  name: `Project ${_id}`,
  type,
  sector,
  region: 'Skeena',
  currentPhaseName: { _id: 'ph', name: 'Early Engagement' },
});

const ROWS = [
  project('p1', 'Mines', 'Coal Mines'),
  project('p2', 'Mines', 'Coal Mines'),
  project('p3', 'Mines', 'Mineral Mines'),
  // Track spelling, folded into the Constants one.
  project('p4', 'Energy - Electricity', 'Hydroelectric'),
];

function renderTree(answer: Response | typeof PENDING) {
  const requests = stubFetch((url) => (url.includes('dataset=Project') ? answer : undefined));
  const client = makeQueryClient();
  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return { requests, ...renderHook(() => useProjectTypeTree(), { wrapper }) };
}

describe('useProjectTypeTree', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('holds no tree and no failure while the list loads', () => {
    const { result } = renderTree(PENDING);

    expect(result.current).toEqual({ tree: null, total: 0, failed: false });
  });

  it('groups the projects by type and sub-type from one project search', async () => {
    const { result, requests } = renderTree(envelope(ROWS));

    await waitFor(() => expect(result.current.tree).not.toBeNull());

    expect(result.current.failed).toBe(false);
    expect(result.current.total).toBe(4);
    expect(result.current.tree!.map((t) => [t.name, t.count])).toEqual([
      ['Mines', 3],
      ['Energy-Electricity', 1],
    ]);
    expect(result.current.tree![0]!.subs.map((s) => [s.name, s.count])).toEqual([
      ['Coal Mines', 2],
      ['Mineral Mines', 1],
    ]);
    expect(requests.filter((url) => url.includes('dataset=Project'))).toHaveLength(1);
  });

  it('reports a failure when the search answers no projects', async () => {
    const { result } = renderTree(envelope([]));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.total).toBe(0);
  });

  it('reports a failure when the search answers 500', async () => {
    const { result } = renderTree(json(null, 500));

    await waitFor(() => expect(result.current.failed).toBe(true));
  });
});
