import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { makeQueryClient, emptySearchEnvelope } from '../../../test-utils';
import type { TypeCountsResult } from './use-type-counts';

const COUNTS_PATH = '/search/counts';

/** Totals the stub answers with, per dataset, for whichever leg asks. */
let totals: Record<string, number | null>;
let countsStatus: number;
let countsCalls: string[];
let searchCalls: string[];
let signals: (AbortSignal | undefined)[];
let pendingCounts: boolean;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function countsBody() {
  return [{ counts: totals, meta: [{ unavailable: [], degraded: [], cached: false }] }];
}

function searchBody(url: string) {
  const dataset = new URL(url, 'http://localhost').searchParams.get('dataset') ?? '';
  return [{ searchResults: [], meta: [{ searchResultsTotal: totals[dataset] ?? 0 }] }];
}

function stubFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    signals.push(init?.signal ?? undefined);
    if (url.includes(COUNTS_PATH)) {
      countsCalls.push(url);
      if (countsStatus !== 200) return new Response('', { status: countsStatus });
      // A request left in flight: it only settles if something aborts it, as fetch behaves.
      if (pendingCounts) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      }
      return jsonResponse(countsBody());
    }
    searchCalls.push(url);
    if (url.includes('dataset=')) return jsonResponse(searchBody(url));
    return emptySearchEnvelope();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** A fresh module per test: the unsupported-endpoint flag is remembered for the whole session. */
async function loadHook() {
  vi.resetModules();
  return (await import('./use-type-counts')).useTypeCounts;
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

async function renderCounts(keywords: string) {
  const useTypeCounts = await loadHook();
  return renderHook<TypeCountsResult, { keywords: string }>(
    ({ keywords: term }) => useTypeCounts(term),
    { wrapper: wrapperFor(makeQueryClient()), initialProps: { keywords } },
  );
}

beforeEach(() => {
  totals = { Project: 4, Document: 11, RecentActivity: 2, ProjectNotification: 7 };
  countsStatus = 200;
  countsCalls = [];
  searchCalls = [];
  signals = [];
  pendingCounts = false;
  window.__env = { logLevel: 4, SEARCH_API_PATH: '/demi-search' };
  stubFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useTypeCounts', () => {
  it('reads one total per record type from the counts endpoint', async () => {
    const { result } = await renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(result.current.counts).toEqual({
      projects: 4,
      documents: 11,
      activities: 2,
      notifications: 7,
    });
    expect(countsCalls[0]).toContain('/demi-search/search/counts?keywords=lng');
    expect(searchCalls).toHaveLength(0);
  });

  it('leaves a type the backend could not measure unknown', async () => {
    totals['ProjectNotification'] = null;

    const { result } = await renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(result.current.counts?.notifications).toBeNull();
    expect(result.current.counts?.documents).toBe(11);
  });

  it('counts with four searches when the endpoint is not deployed, and probes it once', async () => {
    countsStatus = 404;

    const { result, rerender } = await renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(result.current.counts).toEqual({
      projects: 4,
      documents: 11,
      activities: 2,
      notifications: 7,
    });
    expect(searchCalls).toHaveLength(4);
    expect(searchCalls[0]).toContain('dataset=Project');

    rerender({ keywords: 'mine' });
    await waitFor(() => expect(searchCalls).toHaveLength(8));
    expect(countsCalls).toHaveLength(1);
  });

  it('drops the request in flight when the keyword changes', async () => {
    pendingCounts = true;

    const { rerender } = await renderCounts('lng');

    await waitFor(() => expect(countsCalls).toHaveLength(1));
    rerender({ keywords: 'lng plant' });

    await waitFor(() => expect(countsCalls).toHaveLength(2));
    expect(signals[0]?.aborted).toBe(true);
  });

  it('asks for nothing below the keyword floor', async () => {
    vi.useFakeTimers();

    const { result } = await renderCounts('l');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(countsCalls).toHaveLength(0);
    expect(searchCalls).toHaveLength(0);
    expect(result.current.counts).toBeUndefined();
  });
});
