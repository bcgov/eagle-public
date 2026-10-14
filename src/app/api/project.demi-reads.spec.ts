import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDocumentsByMultiId } from './api';
import { queryClient } from './query-client';
import {
  allProjectsQueryOptions,
  bannerPeriod,
  getById,
  periodsInWindow,
  projectPinsQueryOptions,
  searchProjectIds,
} from './project';
import { loadConfig } from 'app/config/config';
import { native } from 'app/pages/home/home-fetch.spec-helper';
import { Project } from 'app/models/project';
import type { CommentPeriod } from 'app/models/commentperiod';

/**
 * The project list, the project record and its pins, as DEMI's native routes answer them. DEMI
 * stores a project under Track's field names where the pages read Eagle's, so `Project.fromNative`
 * is pinned down here too.
 */
describe('project reads served by DEMI', () => {
  const DEMI = '/demi-projects';
  const SEARCH = '/demi-search';
  const NATIVE = '/demi/api/projects';
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  /**
   * `GET /api/projects/58851197aaecd9001b8227cc` on test, trimmed to the fields the model reads.
   * `applicableRegulation` is absent from every stored document sampled there, so its
   * `{_id, name, item}` shape is the Eagle one it mirrors.
   */
  const DEMI_DOC = {
    id: '3',
    trackProjectId: 3,
    eagleId: '58851197aaecd9001b8227cc',
    name: 'Ajax Mine',
    description: 'KGHM Ajax Mining Inc. proposed to develop a new open-pit copper and gold mine.',
    projectType: 'Mines',
    projectSubType: 'Mineral Mines',
    projectState: 'Closed',
    address: 'Southern Interior BC',
    updatedAt: '2026-09-07T17:17:43.028Z',
    dateUpdated: '2019-01-10T21:03:15.945Z',
    region: 'Thompson-Nicola',
    sector: 'Mineral Mines',
    centroid: { type: 'Point', coordinates: [-120.4667, 50.6333] },
    legislation: '2002 Environmental Assessment Act',
    build: 'new',
    code: 'ajax-mine',
    dateAdded: 'Sun Jan 22 2017 20:10:00 GMT+0000 (Coordinated Universal Time)',
    eacDecision: { _id: '5e27937a749c83437054f215', name: 'Certificate Refused' },
    applicableRegulation: {
      _id: '5f1a2b3c4d5e6f0011223344',
      name: 'BC Energy Regulator',
      item: 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_08036_01',
    },
    currentPhaseName: { _id: '5d3f6c7eda7a384218296039', name: 'Post Decision - Complete' },
    CEAAInvolvement: { _id: '5e27937a749c83437054f202', name: 'Coordinated' },
    CEAALink: 'https://iaac-aeic.gc.ca/050/evaluations/proj/62225',
    projectLeadPhone: '778-698-9280',
    proponentId: '58850f69aaecd9001b8085cd',
    proponentName: 'KGHM Ajax Mining Incorporated',
    eaCertificate: 'E17-01',
    // Deliberately neither sorted nor reverse-sorted, so a sort cannot be mistaken for a reverse.
    pins: [
      { _id: '5d8d48b9aae358f02271fa77', name: 'Tsay Keh Dene Band', province: 'BC' },
      { _id: '58850f6baaecd9001b8086b8', name: 'Esdilagh First Nation', province: 'BC' },
      { _id: '5d8d48b9aae358f02271fa99', name: 'Kwadacha Nation', province: 'BC' },
    ],
  };

  /** How demi-search wraps `/search` rows. */
  function envelope(rows: unknown[], total = rows.length): string {
    return JSON.stringify([{ searchResults: rows, meta: [{ searchResultsTotal: total }] }]);
  }

  function respondWith(...responses: (string | Response)[]): void {
    let call = 0;
    fetchMock = vi.fn(async () => {
      const body = responses[Math.min(call++, responses.length - 1)];
      return typeof body === 'string' ? new Response(body, { status: 200 }) : body.clone();
    });
    vi.stubGlobal('fetch', fetchMock);
  }

  function requestedUrls(): string[] {
    return fetchMock.mock.calls.map((call) => call[0] as string);
  }

  async function setup(paths: { demi?: string; search?: string }): Promise<void> {
    window.__env = {
      logLevel: 4,
      DEMI_PROJECTS_PATH: paths.demi ?? '',
      SEARCH_API_PATH: paths.search ?? '',
    };
    await loadConfig();
  }

  beforeEach(() => {
    // getDemiProject reads through the app's shared cache, so one test must not answer the next.
    queryClient.clear();
    respondWith(envelope([]));
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
  });

  describe('Project.fromNative', () => {
    it('keys the project by its Eagle id, which the routes carry', () => {
      expect(Project.fromNative(DEMI_DOC)._id).toBe('58851197aaecd9001b8227cc');
    });

    it('falls back to the DEMI id for a project Eagle never held', () => {
      const { eagleId: _dropped, ...demiOnly } = DEMI_DOC;

      expect(Project.fromNative(demiOnly)._id).toBe('3');
    });

    it('fills the names the pages read from the Track-spelled fields', () => {
      const project = Project.fromNative(DEMI_DOC);

      expect(project.type).toBe('Mines');
      expect(project.status).toBe('Closed');
      expect(project.location).toBe('Southern Interior BC');
    });

    it('rebuilds the proponent that DEMI stores as two scalars', () => {
      expect(Project.fromNative(DEMI_DOC).proponent).toEqual({
        _id: '58850f69aaecd9001b8085cd',
        name: 'KGHM Ajax Mining Incorporated',
      });
    });

    it('unwraps the GeoJSON centroid into the [lon, lat] pair the map takes', () => {
      expect(Project.fromNative(DEMI_DOC).centroid).toEqual([-120.4667, 50.6333]);
    });

    it('leaves the centroid empty when DEMI carries none', () => {
      const { centroid: _dropped, ...withoutCentroid } = DEMI_DOC;

      expect(Project.fromNative(withoutCentroid).centroid).toEqual([]);
    });

    it('carries the populated List rows through', () => {
      const project = Project.fromNative(DEMI_DOC);

      expect(project.eacDecision.name).toBe('Certificate Refused');
      expect(project.currentPhaseName.name).toBe('Post Decision - Complete');
      expect(project.CEAAInvolvement.name).toBe('Coordinated');
    });

    it('leaves a bare List id undefined, so the fact keeps its dash rather than showing the id', () => {
      const project = Project.fromNative({ ...DEMI_DOC, eacDecision: '5e27937a749c83437054f215' });

      expect(project.eacDecision).toBeUndefined();
    });

    it('carries the record last-updated date DEMI mirrors from Eagle, not its sync stamp', () => {
      expect(Project.fromNative(DEMI_DOC).dateUpdated).toBe('2019-01-10T21:03:15.945Z');
    });

    it('passes the same-named fields straight through', () => {
      const project = Project.fromNative(DEMI_DOC);

      expect(project.name).toBe('Ajax Mine');
      expect(project.CEAALink).toBe('https://iaac-aeic.gc.ca/050/evaluations/proj/62225');
      expect(project.eaCertificate).toBe('E17-01');
      expect(project.applicableRegulation.name).toBe('BC Energy Regulator');
    });
  });

  describe('allProjectsQueryOptions', () => {
    const second = { ...DEMI_DOC, id: '4', eagleId: 'e4', name: 'Brucejack' };

    it('reads the native project list by name, counted', async () => {
      await setup({});
      respondWith(native([DEMI_DOC]));

      const projects = await queryClient.fetchQuery(allProjectsQueryOptions());

      expect(projects.map((project) => project._id)).toEqual(['58851197aaecd9001b8227cc']);
      expect(requestedUrls()).toEqual([`${NATIVE}?page=1&pageSize=100&count=true&sort=name`]);
    });

    it('reads every page DEMI counted, since an anonymous page holds 100', async () => {
      await setup({});
      respondWith(native([DEMI_DOC], 150), native([second], 150));

      const projects = await queryClient.fetchQuery(allProjectsQueryOptions());

      expect(projects.map((project) => project.name)).toEqual(['Ajax Mine', 'Brucejack']);
      expect(requestedUrls()[1]).toBe(`${NATIVE}?page=2&pageSize=100&count=true&sort=name`);
    });
  });

  describe('searchProjectIds', () => {
    it('asks the native list with the keywords and keeps its best-match order', async () => {
      await setup({});
      respondWith(
        native([
          { ...DEMI_DOC, eagleId: 'p2' },
          { ...DEMI_DOC, eagleId: 'p1' },
        ]),
      );

      expect(await searchProjectIds('ajax mine')).toEqual(['p2', 'p1']);
      // No sort: one would replace the relevance order.
      expect(requestedUrls()).toEqual([`${NATIVE}?page=1&pageSize=100&count=true&q=ajax+mine`]);
    });

    it('throws on a failed read, so the page can say the search failed', async () => {
      await setup({});
      respondWith(new Response('{"error":"down"}', { status: 500 }));

      await expect(searchProjectIds('ajax')).rejects.toThrow('500');
    });
  });

  describe('periodsInWindow', () => {
    const period = (dateStarted: string, dateCompleted: string) =>
      ({
        _id: `${dateStarted}-${dateCompleted}`,
        dateStarted,
        dateCompleted,
      }) as unknown as CommentPeriod;
    const SINCE = '2026-09-01T00:00:00.000Z';
    const UNTIL = '2026-09-30T00:00:00.000Z';

    it('keeps a period that starts inside the window', () => {
      const rows = periodsInWindow(
        [period('2026-09-10T00:00:00.000Z', '2026-10-20T00:00:00.000Z')],
        SINCE,
        UNTIL,
      );

      expect(rows).toHaveLength(1);
    });

    it('keeps a period that ends inside the window', () => {
      const rows = periodsInWindow(
        [period('2026-08-01T00:00:00.000Z', '2026-09-05T00:00:00.000Z')],
        SINCE,
        UNTIL,
      );

      expect(rows).toHaveLength(1);
    });

    it('keeps a period that spans the whole window', () => {
      const rows = periodsInWindow(
        [period('2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')],
        SINCE,
        UNTIL,
      );

      expect(rows).toHaveLength(1);
    });

    it('drops a period that finished before the window', () => {
      const rows = periodsInWindow(
        [period('2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z')],
        SINCE,
        UNTIL,
      );

      expect(rows).toEqual([]);
    });

    it('keeps a period that starts inside the window but has no completion date', () => {
      // The first clause reads only `dateStarted`, so a record missing `dateCompleted` matches.
      const rows = periodsInWindow([period('2026-09-10T00:00:00.000Z', '')], SINCE, UNTIL);

      expect(rows).toHaveLength(1);
    });

    it('drops a period with no usable dates at all', () => {
      const rows = periodsInWindow([period('', '')], SINCE, UNTIL);

      expect(rows).toEqual([]);
    });

    it('asks for nothing when the caller gave no window', () => {
      const rows = periodsInWindow(
        [period('2026-09-10T00:00:00.000Z', '2026-09-20T00:00:00.000Z')],
        null,
        null,
      );

      expect(rows).toEqual([]);
    });
  });

  describe('bannerPeriod', () => {
    const NOW = Date.parse('2026-09-15T00:00:00.000Z');
    const period = (_id: string, dateStarted: string, dateCompleted: string) =>
      ({ _id, dateStarted, dateCompleted }) as unknown as CommentPeriod;
    const UPCOMING = period('upcoming', '2026-09-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z');
    const OPEN = period('open', '2026-09-05T00:00:00.000Z', '2026-09-25T00:00:00.000Z');
    const OLD = period('old', '2019-01-01T00:00:00.000Z', '2019-02-01T00:00:00.000Z');

    it('picks the period running now over a nearby one that is not', () => {
      expect(bannerPeriod([UPCOMING, OPEN], NOW)?._id).toBe('open');
    });

    it('falls back to a nearby period when none is running', () => {
      expect(bannerPeriod([UPCOMING, OLD], NOW)?._id).toBe('upcoming');
    });

    it('does not take a period that has not started for the running one', () => {
      const RECENTLY_CLOSED = period(
        'recently-closed',
        '2026-08-01T00:00:00.000Z',
        '2026-09-10T00:00:00.000Z',
      );

      expect(bannerPeriod([RECENTLY_CLOSED, UPCOMING], NOW)?._id).toBe('recently-closed');
    });

    it('draws no banner when no period is near today', () => {
      expect(bannerPeriod([OLD], NOW)).toBeNull();
    });
  });

  describe('getById', () => {
    it('reads the project from DEMI in one request', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC));

      const project = await getById('58851197aaecd9001b8227cc');

      expect(project?.name).toBe('Ajax Mine');
      // No comment-period or List read: the banner is its own query and the List rows arrive populated.
      expect(requestedUrls()).toEqual([`${DEMI}/58851197aaecd9001b8227cc`]);
    });

    it('maps the build onto the human readable nature the panel shows', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC));

      expect((await getById('58851197aaecd9001b8227cc'))?.nature).toBe('New Construction');
    });

    // DEMI is the only store there is, so a 404 is the answer: the page renders "not found" off
    // the null rather than asking a second backend.
    it('answers no project when DEMI has no record for it', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(new Response('{}', { status: 404, statusText: 'Not Found' }));

      expect(await getById('p1')).toBeNull();
      expect(requestedUrls()).toEqual([`${DEMI}/p1`]);
    });

    // A store that cannot be reached is not a project that does not exist; the page has its own
    // error state, and swallowing this would show "not found" for an outage.
    it('surfaces a failed DEMI read instead of reporting the project missing', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(new Response('{}', { status: 500, statusText: 'Internal Server Error' }));

      await expect(getById('p1')).rejects.toThrow('500');
    });
  });

  describe('projectPinsQueryOptions', () => {
    /** The pins as the card gets them: `select` runs on the cached project document. */
    async function pinsFor(projId: string) {
      const options = projectPinsQueryOptions(projId);
      return options.select(await queryClient.fetchQuery(options));
    }

    it('reads the pins off the DEMI project document, sorted by name', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC));

      const pins = await pinsFor('58851197aaecd9001b8227cc');

      expect(pins.map((pin) => pin.name)).toEqual([
        'Esdilagh First Nation',
        'Kwadacha Nation',
        'Tsay Keh Dene Band',
      ]);
      expect(pins[0]?.province).toBe('BC');
    });

    it('shares the one project request with the project record: no organization lookup', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC));

      await getById('58851197aaecd9001b8227cc');
      await pinsFor('58851197aaecd9001b8227cc');

      expect(requestedUrls()).toEqual([`${DEMI}/58851197aaecd9001b8227cc`]);
    });

    // No document means no pins, and the card is meant to be absent — not filled from elsewhere.
    it('answers no pins for a project DEMI has no record of', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(new Response('{}', { status: 404, statusText: 'Not Found' }));

      expect(await pinsFor('p1')).toEqual([]);
    });

    it('answers no pins for a DEMI record that carries none', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      const { pins: _dropped, ...withoutPins } = DEMI_DOC;
      respondWith(JSON.stringify(withoutPins));

      expect(await pinsFor('p1')).toEqual([]);
    });
  });

  describe('getDocumentsByMultiId', () => {
    const ROW = {
      _id: 'd1',
      displayName: 'Application',
      documentFileName: 'application.pdf',
      project: 'p1',
      // demi-search answers the whole indexed row; these two are outside the projection the pages
      // read, so they must not survive.
      projectName: 'Ajax Mine',
      highlighted: [],
    };

    it('asks demi-search with a bare pipe-separated docIds list', async () => {
      await setup({ search: SEARCH });
      respondWith(envelope([ROW]));

      await getDocumentsByMultiId(['d1', 'd2']);

      const url = requestedUrls()[0];
      expect(url.startsWith(`${SEARCH}/search?dataset=Document`)).toBe(true);
      expect(url).toContain('&docIds=d1|d2');
      expect(url).not.toContain('and[docIds]');
    });

    it('projects the demi-search row down to the fields the pages read', async () => {
      await setup({ search: SEARCH });
      respondWith(envelope([ROW]));

      const documents = (await getDocumentsByMultiId(['d1'])) as any[];

      expect(documents[0]._id).toBe('d1');
      expect(documents[0].documentFileName).toBe('application.pdf');
      expect(documents[0].projectName).toBeUndefined();
      expect(documents[0].highlighted).toBeUndefined();
    });

    it('labels a row the demi-search index holds no original name for', async () => {
      await setup({ search: SEARCH });
      respondWith(envelope([ROW]));

      const documents = (await getDocumentsByMultiId(['d1'])) as any[];

      expect(documents[0].internalOriginalName).toBe('application.pdf');
    });
  });
});
