import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCommentsByPeriodId,
  getOrgsByCompanyType,
  getPeriod,
  getPeriodsByProjId,
  getTopNewsItems,
  listsQueryOptions,
} from './api';
import { loadConfig } from 'app/config/config';

/**
 * The reads demi-search serves.
 *
 * Every one of them answers the same `[{searchResults, meta}]` envelope, so a request built with the
 * wrong parameter spelling still renders — it just serves the wrong rows. These pin the URL each
 * read sends and the unwrapping on the way back.
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

  /** How demi-search wraps `/search` rows. */
  function envelope(rows: unknown[], total = rows.length): string {
    return JSON.stringify([{ searchResults: rows, meta: [{ searchResultsTotal: total }] }]);
  }

  function respondWith(...bodies: string[]): void {
    let call = 0;
    fetchMock = vi.fn(
      async () => new Response(bodies[Math.min(call++, bodies.length - 1)], { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
  }

  function requestedUrls(): string[] {
    return fetchMock.mock.calls.map((call) => call[0] as string);
  }

  async function setup(searchApiPath: string): Promise<void> {
    window.__env = { logLevel: 4, SEARCH_API_PATH: searchApiPath };
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
      expect(orgs).toEqual(ORGS);
    });

    // demi-search answers 400 above 500 rows on any filtered search, and this query is always filtered.
    it('never asks a filtered page bigger than demi-search allows', async () => {
      await setup(SEARCH);
      respondWith(envelope(ORGS));

      await getOrgsByCompanyType('Proponent/Certificate Holder');

      const pageSize = Number(new URL(requestedUrl(), 'http://x').searchParams.get('pageSize'));
      expect(pageSize).toBeLessThanOrEqual(500);
    });

    it('pages until it holds every organization the backend counted', async () => {
      await setup(SEARCH);
      const first = Array.from({ length: 500 }, (_, i) => ({ _id: `o${i}`, name: `Org ${i}` }));
      respondWith(envelope(first, 502), envelope(ORGS, 502));

      const orgs = await getOrgsByCompanyType('Proponent/Certificate Holder');

      expect(orgs).toHaveLength(502);
      expect(
        requestedUrls().map((u) => new URL(u, 'http://x').searchParams.get('pageNum')),
      ).toEqual(['0', '1']);
    });

    it('returns an empty list rather than undefined when the envelope carries no rows', async () => {
      await setup(SEARCH);
      respondWith(JSON.stringify([]));

      expect(await getOrgsByCompanyType('Proponent/Certificate Holder')).toEqual([]);
    });

    /**
     * Envelope recorded from demi-search on test
     * (`/demi-search/search?dataset=Organization&pageSize=1`): rows carry `count` alongside `meta`,
     * and the row itself is the redacted catalog shape.
     */
    it('unwraps a recorded demi-search envelope', async () => {
      await setup(SEARCH);
      respondWith(
        JSON.stringify([
          {
            searchResults: [
              {
                id: '58850f68aaecd9001b808530',
                kind: 'Organization',
                eagleId: '58850f68aaecd9001b808530',
                sourceSystem: 'eagle',
                name: '445026 BC Limited',
                companyType: 'Proponent/Certificate Holder',
                province: 'British Columbia',
                country: 'Canada',
                address1: '',
                city: '',
                postal: '',
                website: '',
                isPublished: true,
                _id: '58850f68aaecd9001b808530',
                _schemaName: 'Organization',
              },
            ],
            count: 1,
            meta: [{ searchResultsTotal: 1 }],
          },
        ]),
      );

      const orgs = await getOrgsByCompanyType('Proponent/Certificate Holder');

      expect(orgs).toHaveLength(1);
      expect(orgs[0]).toMatchObject({ _id: '58850f68aaecd9001b808530', name: '445026 BC Limited' });
    });
  });

  describe('listsQueryOptions', () => {
    it('reads the filter lists off demi-search', async () => {
      await setup(SEARCH);
      respondWith(envelope(LISTS));

      const lists = await listsQueryOptions().queryFn();

      expect(requestedUrl()).toBe(`${SEARCH}/search?pageSize=250&dataset=List`);
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
      // demi-search reads `top` bare; under `and[]` it is accepted and ignored, which serves the
      // whole activity feed instead of the curated strip.
      expect(url).toContain('&top=true');
      expect(url).not.toContain('and[top]');
      expect(url).toContain('&pageSize=4');
      // `top=true` orders pinned first; a sort of our own would undo that.
      expect(url).not.toContain('&sortBy=');
      expect(news).toEqual(NEWS);
    });
  });

  describe('getPeriodsByProjId', () => {
    const PERIODS = [
      { _id: 'cp-1', project: 'proj-1', dateStarted: '2026-01-01', informationLabel: 'Round two' },
      { _id: 'cp-2', project: 'proj-1', dateStarted: '2020-01-01', informationLabel: 'Round one' },
    ];

    it('asks demi-search for the project periods, newest first', async () => {
      await setup(SEARCH);
      respondWith(envelope(PERIODS));

      const periods = await getPeriodsByProjId('proj-1');

      const url = requestedUrl();
      expect(url.startsWith(`${SEARCH}/search?dataset=CommentPeriod`)).toBe(true);
      expect(url).toContain('&and[project]=proj-1');
      expect(url).toContain('&sortBy=-dateStarted');
      expect(periods.map((period) => period._id)).toEqual(['cp-1', 'cp-2']);
    });

    /**
     * `/search` answers the whole stored record where the removed `/commentperiod` route projected a
     * fixed set. Without a projection here the cards would show `additionalText` in place of the
     * description they derive from the instructions.
     */
    it('carries only the fields the engagement cards have always been given', async () => {
      await setup(SEARCH);
      respondWith(
        envelope([
          {
            _id: 'cp-1',
            project: 'proj-1',
            dateStarted: '2026-01-01',
            dateCompleted: '2026-02-01',
            instructions: '<p>Comment Period on the Draft Application for Cedar</p>',
            isMet: false,
            metURL: '',
            informationLabel: 'Round two',
            additionalText: 'A long legacy paragraph the cards never showed',
            phaseName: 'Review',
            read: ['public'],
          },
        ]),
      );

      const [period] = await getPeriodsByProjId('proj-1');

      expect(period).toEqual({
        _id: 'cp-1',
        project: 'proj-1',
        dateStarted: '2026-01-01',
        dateCompleted: '2026-02-01',
        instructions: '<p>Comment Period on the Draft Application for Cedar</p>',
        isMet: false,
        metURL: '',
        informationLabel: 'Round two',
      });
    });
  });

  describe('getPeriod', () => {
    it('filters one period by id under and[], the spelling the backend reads as a filter', async () => {
      await setup(SEARCH);
      respondWith(envelope([{ _id: 'cp-1' }]));

      const periods = await getPeriod('cp-1');

      const url = requestedUrl();
      expect(url).toContain('&and[_id]=cp-1');
      // A bare `_id` is not read as a filter and answers the whole collection, so the details page
      // would render whichever period happened to sort first.
      expect(url).not.toContain('&_id=cp-1');
      expect(periods.map((period) => period._id)).toEqual(['cp-1']);
    });

    /** Envelope recorded from demi-search on test, period 5980d4f8436253001dcaf8b8. */
    it('unwraps a recorded demi-search envelope', async () => {
      await setup(SEARCH);
      respondWith(
        JSON.stringify([
          {
            searchResults: [
              {
                id: '5980d4f8436253001dcaf8b8',
                projectId: '3',
                eagleId: '5980d4f8436253001dcaf8b8',
                sourceSystem: 'eagle',
                dateStarted: '2017-08-08T20:00:00.000Z',
                dateCompleted: '2017-10-11T06:59:00.000Z',
                dateAdded: '2017-08-01T18:24:24.406Z',
                isMet: false,
                metURL: '',
                informationLabel: '',
                instructions: 'Comment on the Ajax Mine Project.',
                openHouses: [{ description: 'Kamloops', eventDate: '2017-08-22T17:00:00.000Z' }],
                relatedDocuments: [''],
                commentTip: '',
                isPublished: true,
                _id: '5980d4f8436253001dcaf8b8',
                _schemaName: 'CommentPeriod',
                project: '58851197aaecd9001b8227cc',
              },
            ],
            count: 1,
            meta: [{ searchResultsTotal: 1 }],
          },
        ]),
      );

      const [period] = await getPeriod('5980d4f8436253001dcaf8b8');

      expect(period).toMatchObject({
        _id: '5980d4f8436253001dcaf8b8',
        project: '58851197aaecd9001b8227cc',
        instructions: 'Comment on the Ajax Mine Project.',
      });
      expect(period.openHouses).toHaveLength(1);
    });

    /**
     * `/search` answers the whole stored record where the removed `/commentperiod` route projected a
     * fixed set, so without a projection here the admin and role fields (`metURLAdmin`,
     * `classificationRoles`, ...) and the unread `commentTip` reach the details page.
     */
    it('carries only the fields the details page has always been given', async () => {
      await setup(SEARCH);
      respondWith(
        envelope([
          {
            _id: 'cp-1',
            project: 'proj-1',
            dateStarted: '2026-01-01',
            dateCompleted: '2026-02-01',
            instructions: '<p>Comment on the draft application for Cedar</p>',
            informationLabel: 'Round two',
            additionalText: 'A legacy paragraph',
            openHouses: [{ description: 'Kamloops', eventDate: '2026-01-15' }],
            relatedDocuments: ['doc-1'],
            commentTip: '<em>Keep it on topic</em>',
            metURLAdmin: 'https://admin.example/internal',
            classificationRoles: ['staff'],
            commenterRoles: ['staff'],
            downloadRoles: ['staff'],
            read: ['public'],
          },
        ]),
      );

      const [period] = await getPeriod('cp-1');

      expect(period).toEqual({
        _id: 'cp-1',
        project: 'proj-1',
        dateStarted: '2026-01-01',
        dateCompleted: '2026-02-01',
        instructions: '<p>Comment on the draft application for Cedar</p>',
        informationLabel: 'Round two',
        additionalText: 'A legacy paragraph',
        openHouses: [{ description: 'Kamloops', eventDate: '2026-01-15' }],
        relatedDocuments: ['doc-1'],
      });
    });
  });

  describe('getCommentsByPeriodId', () => {
    const ROWS = [
      { _id: 'c1', commentId: 2, author: 'Jane', comment: 'Second' },
      { _id: 'c2', commentId: 1, comment: 'First' },
    ];

    it('asks demi-search for one page of a period, newest first', async () => {
      await setup(SEARCH);
      respondWith(envelope(ROWS, 783));

      const page = await getCommentsByPeriodId(0, 10, 'cp-1');

      const url = requestedUrl();
      expect(url.startsWith(`${SEARCH}/search?dataset=Comment`)).toBe(true);
      expect(url).toContain('&and[period]=cp-1');
      expect(url).toContain('&sortBy=-commentId');
      expect(url).toContain('&pageSize=10');
      expect(page.comments).toEqual(ROWS);
    });

    // The caller counts pages from zero and `searchKeywords` from one; sending the raw number would
    // serve page two's comments under page one's controls.
    it('keeps the caller on the page it asked for', async () => {
      await setup(SEARCH);
      respondWith(envelope(ROWS, 783));

      await getCommentsByPeriodId(3, 10, 'cp-1');

      expect(new URL(requestedUrl(), 'http://x').searchParams.get('pageNum')).toBe('3');
    });

    it('counts the period from the envelope demi-search answers with', async () => {
      await setup(SEARCH);
      respondWith(envelope(ROWS, 783));

      expect((await getCommentsByPeriodId(0, 10, 'cp-1')).totalCount).toBe(783);
    });

    // The table falls back to "unknown total" rather than reporting zero comments.
    it('reports no count when the envelope carries no meta block', async () => {
      await setup(SEARCH);
      respondWith(JSON.stringify([{ searchResults: ROWS }]));

      expect((await getCommentsByPeriodId(0, 10, 'cp-1')).totalCount).toBeNull();
    });

    /**
     * Rows recorded from demi-search on test, period 5980d4f8436253001dcaf8b8. An anonymous
     * comment carries no `author` key at all; the table prints "Anonymous" for it, and nothing
     * here may invent one.
     */
    it('unwraps a recorded demi-search envelope, anonymous rows included', async () => {
      await setup(SEARCH);
      respondWith(
        JSON.stringify([
          {
            searchResults: [
              {
                id: '598b9e271ecbc9001dfeba56',
                projectId: '3',
                eagleId: '598b9e271ecbc9001dfeba56',
                periodId: '5980d4f8436253001dcaf8b8',
                sourceSystem: 'eagle',
                comment: 'Hurrah for the Indigenous peoples.',
                dateAdded: '2017-08-09T23:48:06.876Z',
                dateUpdated: null,
                location: null,
                submittedCAC: false,
                isAnonymous: true,
                documents: [],
                commentId: 2,
                eaoStatus: 'Published',
                isPublished: true,
                _id: '598b9e271ecbc9001dfeba56',
                _schemaName: 'Comment',
                period: '5980d4f8436253001dcaf8b8',
              },
              {
                id: '598c783677a2820019e6e47a',
                periodId: '5980d4f8436253001dcaf8b8',
                comment: 'This mine is too close to the city.',
                dateAdded: '2017-08-10T15:20:12.393Z',
                isAnonymous: false,
                documents: ['598cc094832a6300190e476e'],
                commentId: 7,
                author: 'Crystal Brand',
                _id: '598c783677a2820019e6e47a',
                _schemaName: 'Comment',
                period: '5980d4f8436253001dcaf8b8',
              },
            ],
            count: 783,
            meta: [{ searchResultsTotal: 783 }],
          },
        ]),
      );

      const page = await getCommentsByPeriodId(0, 10, '5980d4f8436253001dcaf8b8');

      expect(page.totalCount).toBe(783);
      expect(page.comments[0].author).toBeUndefined();
      expect(page.comments[1]).toMatchObject({
        author: 'Crystal Brand',
        documents: ['598cc094832a6300190e476e'],
      });
    });
  });
});
