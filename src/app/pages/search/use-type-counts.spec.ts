import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { loadConfig } from 'app/config/config';
import { makeQueryClient } from '../../../test-utils';
import { native } from '../home/home-fetch.spec-helper';
import { useTypeCounts, type TypeCountsResult } from './use-type-counts';

/** Totals the stub answers with, per native kind. */
let totals: Record<string, number>;
/** Kinds whose read answers 500. */
let failing: Set<string>;
let calls: string[];
let signals: (AbortSignal | undefined)[];
let pendingCounts: boolean;

/** The native kind a request reads: `/demi/api/<kind>?...`. */
function kindOf(url: string): string {
  return new URL(url, 'http://localhost').pathname.replace(/^\/demi\/api\//, '');
}

function stubFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    signals.push(init?.signal ?? undefined);
    const kind = kindOf(url);
    if (failing.has(kind)) return new Response('', { status: 500 });
    if (kind === 'counts') {
      // A request left in flight: it only settles if something aborts it, as fetch behaves.
      if (pendingCounts) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      }
      return new Response(
        JSON.stringify({ projects: totals['projects'], documents: totals['documents'] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return native([], totals[kind] ?? 0);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function renderCounts(keywords: string) {
  return renderHook<TypeCountsResult, { keywords: string }>(
    ({ keywords: term }) => useTypeCounts(term),
    { wrapper: wrapperFor(makeQueryClient()), initialProps: { keywords } },
  );
}

function callTo(kind: string): URL {
  const url = calls.find((call) => kindOf(call) === kind);
  if (!url) throw new Error(`no ${kind} read`);
  return new URL(url, 'http://localhost');
}

beforeEach(async () => {
  totals = { projects: 4, documents: 11, updates: 2, notifications: 7, 'comment-periods': 3 };
  failing = new Set();
  calls = [];
  signals = [];
  pendingCounts = false;
  window.__env = { logLevel: 4 };
  await loadConfig();
  stubFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useTypeCounts', () => {
  it('reads one total per record type', async () => {
    const { result } = renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(result.current.counts).toEqual({
      projects: 4,
      documents: 11,
      activities: 2,
      notifications: 7,
      commentPeriods: 3,
    });
  });

  it('counts projects and documents in one /counts read with the keyword', async () => {
    const { result } = renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    const counts = callTo('counts');
    expect(counts.searchParams.get('kind')).toBe('projects,documents');
    expect(counts.searchParams.get('q')).toBe('lng');
  });

  it.each(['updates', 'notifications'])(
    'counts %s with a one-row counted read of the keyword',
    async (kind) => {
      const { result } = renderCounts('lng');

      await waitFor(() => expect(result.current.counts).toBeDefined());
      const read = callTo(kind);
      expect(read.searchParams.get('q')).toBe('lng');
      expect(read.searchParams.get('pageSize')).toBe('1');
      expect(read.searchParams.get('count')).toBe('true');
    },
  );

  it('counts every comment period, since that list takes no keyword', async () => {
    const { result } = renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(callTo('comment-periods').searchParams.has('q')).toBe(false);
  });

  it('leaves a type unknown, not zero, when its read fails', async () => {
    failing.add('notifications');

    const { result } = renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(result.current.counts?.notifications).toBeNull();
    expect(result.current.counts?.documents).toBe(11);
  });

  it('leaves projects and documents unknown when /counts fails', async () => {
    failing.add('counts');

    const { result } = renderCounts('lng');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(result.current.counts?.projects).toBeNull();
    expect(result.current.counts?.documents).toBeNull();
    expect(result.current.counts?.activities).toBe(2);
  });

  it('drops the request in flight when the keyword changes', async () => {
    pendingCounts = true;

    const { rerender } = renderCounts('lng');

    await waitFor(() => expect(calls.filter((url) => kindOf(url) === 'counts')).toHaveLength(1));
    rerender({ keywords: 'lng plant' });

    await waitFor(() => expect(calls.filter((url) => kindOf(url) === 'counts')).toHaveLength(2));
    expect(signals[calls.findIndex((url) => kindOf(url) === 'counts')]?.aborted).toBe(true);
  });

  it('counts everything below the keyword floor, as the results themselves do', async () => {
    const { result } = renderCounts('l');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(callTo('counts').searchParams.has('q')).toBe(false);
  });

  it('counts everything before a keyword is typed, so the tabs open with totals', async () => {
    const { result } = renderCounts('');

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(result.current.counts?.documents).toBe(11);
    expect(callTo('updates').searchParams.has('q')).toBe(false);
  });
});
