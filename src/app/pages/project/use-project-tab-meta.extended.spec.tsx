import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from 'app/api/query-client';
import { json, native, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { makeQueryClient } from '../../../test-utils';
import { pacificLink } from './extended/content/pacific-link';
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

/** Every URL the strip asked for, decoded. */
let requests: string[];

function renderStrip(page: ExtendedPage) {
  const client = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useExtendedTabMeta('lib-1', page, [], null), { wrapper });
}

beforeEach(() => {
  requests = stubFetch((url) => {
    if (url === '/demi-projects/lib-1') return json({ id: 'track-1', eagleId: 'lib-1' });
    if (url.startsWith('/demi/api/documents?')) return native([], 7);
    return undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  // `readDocuments` resolves the DEMI project id through the app-wide query cache.
  queryClient.clear();
});

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
    // The documents count and the DEMI project id it is read under; no updates, comment periods or
    // document-kind probes.
    expect(requests.filter((url) => !url.startsWith('/demi-projects/'))).toEqual([
      '/demi/api/documents?page=1&pageSize=1&count=true&project=track-1',
    ]);
  });

  it('leaves Timeline out of the Pacific Link strip, whose tabs do not name it', () => {
    const { result } = renderStrip(pacificLink);

    expect(result.current.map((tab) => tab.key)).not.toContain('timeline');
  });

  it('gives a page without tabs the standard strip', () => {
    const { tabs: _tabs, ...withoutTabs } = PAGE;
    const { result } = renderStrip(withoutTabs);

    expect(result.current.map((tab) => tab.key)).toEqual([
      'overview',
      'timeline',
      'updates',
      'engagement',
      'documents',
      'decisions',
      'compliance',
    ]);
  });
});
