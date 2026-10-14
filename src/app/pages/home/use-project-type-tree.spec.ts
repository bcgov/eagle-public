import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { makeQueryClient } from '../../../test-utils';
import { json, native, PENDING, stubFetch } from './home-fetch.spec-helper';
import { useProjectTypeTree } from './use-project-type-tree';

/** A row as DEMI's native `/projects` answers it. */
const project = (eagleId: string, projectType: string, sector: string) => ({
  eagleId,
  name: `Project ${eagleId}`,
  projectType,
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

const PROJECTS = '/demi/api/projects?';

/** The first page counts `total` projects but holds only `rows`, and every later page is empty. */
const cutShort = (rows: unknown[], total: number) => (url: string) =>
  native(url.includes('page=1&') ? rows : [], total);

function renderTree(
  answer: Response | typeof PENDING | ((url: string) => Response),
  enabled = true,
) {
  const requests = stubFetch((url) => {
    if (!url.includes(PROJECTS)) return undefined;
    return typeof answer === 'function' ? answer(url) : answer;
  });
  const client = makeQueryClient();
  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  const view = renderHook((props: { enabled: boolean }) => useProjectTypeTree(props.enabled), {
    wrapper,
    initialProps: { enabled },
  });
  return { requests, client, ...view };
}

const projectReads = (requests: string[]) =>
  requests.filter((url) => url.includes(PROJECTS)).length;

describe('useProjectTypeTree', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('holds no tree and no failure while the list loads', () => {
    const { result } = renderTree(PENDING);

    expect(result.current).toEqual({ tree: null, total: 0, failed: false, truncated: null });
  });

  it('reads nothing while disabled, and reads once enabled', async () => {
    const { result, requests, rerender } = renderTree(native(ROWS), false);

    await act(() => Promise.resolve());
    expect(projectReads(requests)).toBe(0);
    expect(result.current.tree).toBeNull();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.tree).not.toBeNull());
    expect(projectReads(requests)).toBe(1);
  });

  it('flags a read DEMI cut short, with the rows sent and the total it counted', async () => {
    const { result } = renderTree(cutShort(ROWS, 1500));

    await waitFor(() => expect(result.current.tree).not.toBeNull());
    expect(result.current.truncated).toEqual({ shown: 4, of: 1500 });
  });

  it('counts only the charted projects in a cut-short note, leaving out rows with no id', async () => {
    const { result } = renderTree(cutShort([...ROWS, project('', 'Mines', 'Coal Mines')], 1500));

    await waitFor(() => expect(result.current.tree).not.toBeNull());
    expect(result.current.truncated).toEqual({ shown: result.current.total, of: 1500 });
    expect(result.current.total).toBe(4);
  });

  it('flags nothing when DEMI sent every project', async () => {
    const { result } = renderTree(native(ROWS));

    await waitFor(() => expect(result.current.tree).not.toBeNull());
    expect(result.current.truncated).toBeNull();
  });

  it('groups the projects by type and sub-type from one project read', async () => {
    const { result, requests } = renderTree(native(ROWS));

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
    expect(requests.filter((url) => url.includes(PROJECTS))).toHaveLength(1);
  });

  it('reports a failure when DEMI answers no projects', async () => {
    const { result } = renderTree(native([]));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.total).toBe(0);
  });

  it('reports a failure when DEMI answers 500, and caches no list for /projects', async () => {
    const { result, client } = renderTree(json(null, 500));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(client.getQueryData(['projects', 'all'])).toBeUndefined();
  });
});
