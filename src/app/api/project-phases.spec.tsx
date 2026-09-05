import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { loadConfig } from 'app/config/config';
import { makeQueryClient } from '../../test-utils';
import { phasesOf, useDemiProject, useProjectPhases } from './project-phases';

const DEMI = '/demi-projects';
const original = window.__env;

let fetchMock: ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

async function setup(demiProjectsPath: string): Promise<void> {
  window.__env = { logLevel: 4, API_PATH: '/api', DEMI_PROJECTS_PATH: demiProjectsPath };
  await loadConfig();
}

beforeEach(() => {
  fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          phases: [{ name: 'Early Engagement', startDate: '2020-08-01', endDate: null }],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  window.__env = original;
  vi.unstubAllGlobals();
});

describe('useProjectPhases', () => {
  it('asks DEMI for the project and returns its phases', async () => {
    await setup(DEMI);
    const { result } = renderHook(() => useProjectPhases('proj-1'), { wrapper });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(fetchMock.mock.calls[0][0]).toBe('/demi-projects/proj-1');
    expect(result.current).toEqual([
      { name: 'Early Engagement', startDate: '2020-08-01', endDate: null },
    ]);
  });

  // The off switch: no path means no DEMI, so the rail must ask for nothing at all.
  it('asks for nothing when DEMI_PROJECTS_PATH is unset', async () => {
    await setup('');
    const { result } = renderHook(() => useProjectPhases('proj-1'), { wrapper });

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('asks for nothing without a project id', async () => {
    await setup(DEMI);
    renderHook(() => useProjectPhases(''), { wrapper });

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});

describe('useDemiProject', () => {
  it('exposes the raw document, including shortUrl, so other fields can share the fetch', async () => {
    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            phases: [{ name: 'Early Engagement', startDate: '2020-08-01', endDate: null }],
            shortUrl: 'https://projects.eao.gov.bc.ca/s/abcd2345',
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await setup(DEMI);
    const { result } = renderHook(() => useDemiProject('proj-1'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.shortUrl).toBe('https://projects.eao.gov.bc.ca/s/abcd2345');
  });
});

describe('when DEMI has no record for the project', () => {
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('Not Found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('settles useDemiProject with null and does not retry', async () => {
    await setup(DEMI);
    const { result } = renderHook(() => useDemiProject('proj-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives useProjectPhases its empty value', async () => {
    await setup(DEMI);
    const { result } = renderHook(() => useProjectPhases('proj-1'), { wrapper });

    await waitFor(() => expect(result.current).toEqual([]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('phasesOf', () => {
  it('keeps only well-formed rows', () => {
    expect(
      phasesOf({
        phases: [
          { name: 'Early Engagement', startDate: '2020-08-01', endDate: '2021-01-15' },
          { name: '', startDate: '2020-08-01', endDate: null },
          { startDate: '2020-08-01', endDate: null },
          { name: 'Process Planning', startDate: 1234, endDate: {} },
          null,
          'Readiness Decision',
        ],
      }),
    ).toEqual([
      { name: 'Early Engagement', startDate: '2020-08-01', endDate: '2021-01-15' },
      { name: 'Process Planning', startDate: null, endDate: null },
    ]);
  });

  it.each([{}, { phases: null }, { phases: 'Early Engagement' }, null, 'nonsense'])(
    'is empty for %s',
    (payload) => {
      expect(phasesOf(payload)).toEqual([]);
    },
  );
});
