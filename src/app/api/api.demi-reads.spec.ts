import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrgsByCompanyType, getTopNewsItems, listsQueryOptions } from './api';
import { loadConfig } from 'app/config/config';

/**
 * The reads that moved off eagle-api and onto demi-search.
 *
 * Organization, List and RecentActivity all answer the same `[{searchResults, meta}]` envelope on
 * both backends, so a request sent to the wrong base still renders — it just serves the wrong
 * data, or serves nothing on an environment where the switch is meant to be off. The top-news
 * strip is the one that changes URL shape as well as base: eagle-api answers it from a bespoke
 * `/public/recentActivity?top=true` route that returns a bare array, demi-search from `/search`.
 */
describe('reads served by demi-search', () => {
  const SEARCH = '/demi-search';
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  const ORGS = [
    { _id: 'o1', name: 'Acme Resources' },
    { _id: 'o2', name: 'Borden Energy' },
  ];
  const LISTS = [{ _id: 'l1', name: 'Certificate Issued', type: 'eaDecisions' }];
  const NEWS = [
    { _id: 'n1', headline: 'Pinned item', pinned: true, active: true, project: { _id: 'p1' } },
  ];

  /** demi-search and eagle-api both wrap `/search` rows in this. */
  function envelope(rows: unknown[]): string {
    return JSON.stringify([{ searchResults: rows, meta: [{ searchResultsTotal: rows.length }] }]);
  }

  function respondWith(body: string): void {
    fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  }

  async function setup(searchApiPath: string): Promise<void> {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: searchApiPath };
    await loadConfig();
  }

  function requestedUrl(): string {
    return fetchMock.mock.calls[0][0] as string;
  }

  beforeEach(() => {
    respondWith(envelope([]));
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
  });

  describe('getOrgsByCompanyType', () => {
    it('asks demi-search for the company type, sorted by name', async () => {
      await setup(SEARCH);
      respondWith(envelope(ORGS));

      const orgs = await getOrgsByCompanyType('Proponent/Certificate Holder');

      const url = requestedUrl();
      expect(url.startsWith(`${SEARCH}/search?dataset=Organization`)).toBe(true);
      expect(url).toContain('&and[companyType]=Proponent/Certificate Holder');
      expect(url).toContain('&sortBy=+name');
      expect(url).toContain('&pageSize=1000');
      expect(orgs).toEqual(ORGS);
    });

    it('asks eagle-api for the same query when SEARCH_API_PATH is empty', async () => {
      await setup('');
      respondWith(envelope(ORGS));

      const orgs = await getOrgsByCompanyType('Proponent/Certificate Holder');

      const url = requestedUrl();
      expect(url.startsWith('/api/search?dataset=Organization')).toBe(true);
      expect(url).not.toContain(SEARCH);
      expect(url).toContain('&and[companyType]=Proponent/Certificate Holder');
      expect(orgs).toEqual(ORGS);
    });

    it('returns an empty list rather than undefined when the envelope carries no rows', async () => {
      await setup(SEARCH);
      respondWith(JSON.stringify([]));

      expect(await getOrgsByCompanyType('Proponent/Certificate Holder')).toEqual([]);
    });
  });

  describe('listsQueryOptions', () => {
    it('reads the filter lists off demi-search when configured', async () => {
      await setup(SEARCH);
      respondWith(envelope(LISTS));

      const lists = await listsQueryOptions().queryFn();

      expect(requestedUrl()).toBe(`${SEARCH}/search?pageSize=250&dataset=List`);
      expect(lists).toEqual(LISTS);
    });

    it('reads them off eagle-api when SEARCH_API_PATH is empty', async () => {
      await setup('');
      respondWith(envelope(LISTS));

      const lists = await listsQueryOptions().queryFn();

      expect(requestedUrl()).toBe('/api/search?pageSize=250&dataset=List');
      expect(lists).toEqual(LISTS);
    });
  });

  describe('getTopNewsItems', () => {
    it('asks demi-search for the top set and unwraps the envelope', async () => {
      await setup(SEARCH);
      respondWith(envelope(NEWS));

      const news = await getTopNewsItems();

      const url = requestedUrl();
      expect(url.startsWith(`${SEARCH}/search?dataset=RecentActivity`)).toBe(true);
      expect(url).toContain('&and[top]=true');
      expect(url).toContain('&pageSize=4');
      // `top=true` orders pinned first; a sort of our own would undo that.
      expect(url).not.toContain('&sortBy=');
      expect(news).toEqual(NEWS);
    });

    it('keeps the bespoke eagle-api route, and its bare array, when SEARCH_API_PATH is empty', async () => {
      await setup('');
      respondWith(JSON.stringify(NEWS));

      const news = await getTopNewsItems();

      expect(requestedUrl()).toBe('/api/public/recentActivity?top=true');
      expect(news).toEqual(NEWS);
    });
  });
});
