import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeQueryClient } from '../../../test-utils';
import type { ExtendedPage } from './extended/types';
import { useExtendedTabMeta } from './use-project-tab-meta';

const UPDATE = {
  date: '1 Jan 2026',
  source: 'City of Harbour',
  headline: 'Project announced',
  href: 'https://example.org/announced',
  summary: 'A new wing.',
};

const PAGE: ExtendedPage = {
  version: 1,
  updates: [UPDATE, { ...UPDATE, date: '2 Jan 2026' }],
  tabs: [
    { segment: 'overview', replace: true, main: [] },
    { segment: 'faq', label: 'Questions', title: 'Common questions', main: [] },
    { segment: 'guide', title: 'Visitor guide', main: [] },
    { segment: 'updates', replace: true, count: 'updates', main: [] },
    { segment: 'documents' },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

function searchResponse(total: number) {
  return new Response(
    JSON.stringify([{ searchResults: [], meta: [{ searchResultsTotal: total }] }]),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}

function renderStrip(page: ExtendedPage) {
  const client = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useExtendedTabMeta('lib-1', page, [], null), { wrapper });
}

beforeEach(() => {
  fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    searchResponse(String(input).includes('dataset=Document') ? 7 : 0),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('useExtendedTabMeta', () => {
  it('builds the strip from the page tabs, in their order, with their labels', async () => {
    const { result } = renderStrip(PAGE);

    await waitFor(() => expect(result.current.at(-1)?.count).toBe('7'));
    expect(result.current.map((tab) => [tab.key, tab.label])).toEqual([
      ['overview', 'Overview'],
      ['faq', 'Questions'],
      ['guide', 'Visitor guide'],
      ['updates', 'Updates'],
      ['documents', 'Documents'],
    ]);
  });

  it("counts the page's updates on a `count: 'updates'` tab", () => {
    const { result } = renderStrip(PAGE);

    expect(result.current.find((tab) => tab.key === 'updates')).toMatchObject({
      count: '2',
      show: true,
    });
  });

  it("hides a `count: 'updates'` tab when the page has no updates", () => {
    const { result } = renderStrip({ ...PAGE, updates: [] });

    expect(result.current.find((tab) => tab.key === 'updates')).toMatchObject({
      count: undefined,
      show: false,
    });
  });

  it('asks only for the counts of the standard tabs the page keeps', async () => {
    const { result } = renderStrip(PAGE);

    await waitFor(() => expect(result.current.at(-1)?.count).toBe('7'));
    const asked = fetchMock.mock.calls.map(([input]) => String(input));
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((url) => url.includes('dataset=Document'))).toBe(true);
  });

  it('gives a page without tabs the standard strip', () => {
    const { tabs: _tabs, ...withoutTabs } = PAGE;
    const { result } = renderStrip(withoutTabs);

    expect(result.current.map((tab) => tab.key)).toEqual([
      'overview',
      'updates',
      'engagement',
      'documents',
      'decisions',
      'compliance',
    ]);
  });
});
