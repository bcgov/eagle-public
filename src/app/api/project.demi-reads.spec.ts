import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDocumentsByMultiId, getProjectPins } from './api';
import { queryClient } from './query-client';
import { demiProjectToEagle, getById, getPins, periodsInWindow } from './project';
import { loadConfig } from 'app/config/config';
import type { CommentPeriod } from 'app/models/commentperiod';

/**
 * The project record, its pins and the multi-id document read, once DEMI answers them.
 *
 * DEMI stores a project under Track's field names and eagle-api under Eagle's, so unlike the
 * `/search` reads these cannot share a payload: the difference is the mapping, and that is what
 * most of this file pins down.
 */
describe('project reads served by DEMI', () => {
  const DEMI = '/demi-projects';
  const SEARCH = '/demi-search';
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  /**
   * `GET /demi-projects/58851197aaecd9001b8227cc` on test, 2026-09-08, trimmed to the fields the
   * mapper reads. `applicableRegulation` is catalogued public by DEMI but absent from every stored
   * document sampled there, so its `{_id, name, item}` shape is the eagle-api one it mirrors.
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
    region: 'Thompson-Nicola',
    provElecDist: 'FRN; KAS',
    sector: 'Mineral Mines',
    centroid: { type: 'Point', coordinates: [-120.4667, 50.6333] },
    legislation: '2002 Environmental Assessment Act',
    build: 'new',
    code: 'ajax-mine',
    substitution: false,
    overallProgress: 0,
    eaoMember: 'project-eao-staff',
    dateAdded: 'Sun Jan 22 2017 20:10:00 GMT+0000 (Coordinated Universal Time)',
    decisionDate: '2017-12-13T08:00:00.000Z',
    eacDecision: { _id: '5e27937a749c83437054f215', name: 'Certificate Refused' },
    applicableRegulation: {
      _id: '5f1a2b3c4d5e6f0011223344',
      name: 'BC Energy Regulator',
      item: 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_08036_01',
    },
    currentPhaseName: { _id: '5d3f6c7eda7a384218296039', name: 'Post Decision - Complete' },
    phaseHistory: ['5d3f6c7eda7a38421829602f'],
    CEAAInvolvement: { _id: '5e27937a749c83437054f202', name: 'Coordinated' },
    CEAALink: 'https://iaac-aeic.gc.ca/050/evaluations/proj/62225',
    projectLead: 'Nathan Braun',
    projectLeadEmail: 'Nathan.Braun@gov.bc.ca',
    projectLeadPhone: '778-698-9280',
    responsibleEPD: 'Nathan Braun',
    responsibleEPDEmail: 'Nathan.Braun@gov.bc.ca',
    responsibleEPDPhone: '778-698-9280',
    proponentId: '58850f69aaecd9001b8085cd',
    proponentName: 'KGHM Ajax Mining Incorporated',
    projectCAC: false,
    projectCACPublished: false,
    cacEmail: 'noreply@projects.eao.gov.bc.ca',
    featuredDocuments: ['5cf00136a8cfcc0019e2f4e5'],
    eaCertificate: 'E17-01',
    // Deliberately neither sorted nor reverse-sorted, so a sort cannot be mistaken for a reverse.
    pins: [
      { _id: '5d8d48b9aae358f02271fa77', name: 'Tsay Keh Dene Band', province: 'BC' },
      { _id: '58850f6baaecd9001b8086b8', name: 'Esdilagh First Nation', province: 'BC' },
      { _id: '5d8d48b9aae358f02271fa99', name: 'Kwadacha Nation', province: 'BC' },
    ],
  };

  /** demi-search and eagle-api both wrap `/search` rows in this. */
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
      API_PATH: '/api',
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

  describe('demiProjectToEagle', () => {
    it('renames the Track-spelled fields to the ones the pages read', () => {
      const mapped = demiProjectToEagle(DEMI_DOC);

      expect(mapped._id).toBe('58851197aaecd9001b8227cc');
      expect(mapped.type).toBe('Mines');
      expect(mapped.status).toBe('Closed');
      expect(mapped.location).toBe('Southern Interior BC');
    });

    it('does not pass the DEMI sync stamp off as the record last-updated date', () => {
      // Every project carries the same recent `updatedAt`, so "Last updated" would read as the
      // day of the last sync for all of them.
      expect(demiProjectToEagle(DEMI_DOC).dateUpdated).toBeUndefined();
    });

    it('unwraps the GeoJSON centroid into the [lon, lat] pair the map takes', () => {
      expect(demiProjectToEagle(DEMI_DOC).centroid).toEqual([-120.4667, 50.6333]);
    });

    it('keeps a centroid that is already a bare pair', () => {
      const mapped = demiProjectToEagle({ ...DEMI_DOC, centroid: [-123.1, 49.2] });

      expect(mapped.centroid).toEqual([-123.1, 49.2]);
    });

    it('leaves the centroid empty when DEMI carries none', () => {
      const { centroid: _dropped, ...withoutCentroid } = DEMI_DOC;

      expect(demiProjectToEagle(withoutCentroid).centroid).toEqual([]);
    });

    it('rebuilds the proponent that DEMI stores as two scalars', () => {
      expect(demiProjectToEagle(DEMI_DOC).proponent).toEqual({
        _id: '58850f69aaecd9001b8085cd',
        name: 'KGHM Ajax Mining Incorporated',
      });
    });

    it('carries the applicable regulation label and its BC Laws URL through', () => {
      const regulation = demiProjectToEagle(DEMI_DOC).applicableRegulation as {
        name: string;
        item: string;
      };

      expect(regulation.name).toBe('BC Energy Regulator');
      expect(regulation.item).toBe(
        'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_08036_01',
      );
    });

    it('passes the same-named fields straight through', () => {
      const mapped = demiProjectToEagle(DEMI_DOC);

      expect(mapped.name).toBe('Ajax Mine');
      expect(mapped.legislation).toBe('2002 Environmental Assessment Act');
      expect(mapped.build).toBe('new');
      expect(mapped.CEAALink).toBe('https://iaac-aeic.gc.ca/050/evaluations/proj/62225');
      expect(mapped.dateAdded).toBe(
        'Sun Jan 22 2017 20:10:00 GMT+0000 (Coordinated Universal Time)',
      );
      expect(mapped.projectLeadPhone).toBe('778-698-9280');
      expect(mapped.responsibleEPDPhone).toBe('778-698-9280');
      expect(mapped.eaCertificate).toBe('E17-01');
      expect(mapped.featuredDocuments).toEqual(['5cf00136a8cfcc0019e2f4e5']);
      expect(mapped.eacDecision).toEqual({
        _id: '5e27937a749c83437054f215',
        name: 'Certificate Refused',
      });
      expect(mapped.currentPhaseName).toEqual({
        _id: '5d3f6c7eda7a384218296039',
        name: 'Post Decision - Complete',
      });
    });

    it('gives featured documents an empty array when the document carries none', () => {
      const { featuredDocuments: _dropped, ...bare } = DEMI_DOC;

      expect(demiProjectToEagle(bare).featuredDocuments).toEqual([]);
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
      // eagle-api's first `$or` branch reads only `dateStarted`, so a record missing
      // `dateCompleted` still matches there.
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

  describe('getById', () => {
    const OPEN_PERIOD = {
      _id: 'cp-open',
      dateStarted: '2026-09-05T00:00:00.000Z',
      dateCompleted: '2026-09-25T00:00:00.000Z',
      informationLabel: 'Tell us what you think',
    };
    const OLD_PERIOD = {
      _id: 'cp-old',
      dateStarted: '2019-01-01T00:00:00.000Z',
      dateCompleted: '2019-02-01T00:00:00.000Z',
    };

    it('reads the project from DEMI and the banner from the comment periods', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC), envelope([OPEN_PERIOD, OLD_PERIOD]));

      const project = await getById(
        '58851197aaecd9001b8227cc',
        false,
        '2026-09-01T00:00:00.000Z',
        '2026-09-30T00:00:00.000Z',
      );

      expect(project.name).toBe('Ajax Mine');
      expect(project.proponent.name).toBe('KGHM Ajax Mining Incorporated');
      expect(project.commentPeriodForBanner._id).toBe('cp-open');
      expect(requestedUrls()[0]).toBe(`${DEMI}/58851197aaecd9001b8227cc`);
      expect(requestedUrls()[1].startsWith(`${SEARCH}/search?dataset=CommentPeriod`)).toBe(true);
    });

    it('maps the build onto the human readable nature the panel shows', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC), envelope([]));

      const project = await getById('58851197aaecd9001b8227cc', false, null, null);

      expect(project.nature).toBe('New Construction');
    });

    it('does not ask for comment periods when there is no banner window', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC), envelope([]));

      await getById('58851197aaecd9001b8227cc', false, null, null);

      expect(requestedUrls()).toEqual([`${DEMI}/58851197aaecd9001b8227cc`]);
    });

    it('leaves the banner empty when no period falls in the window', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC), envelope([OLD_PERIOD]));

      const project = await getById(
        '58851197aaecd9001b8227cc',
        false,
        '2026-09-01T00:00:00.000Z',
        '2026-09-30T00:00:00.000Z',
      );

      expect(project.commentPeriodForBanner).toBeNull();
    });

    it('asks eagle-api when DEMI is not configured', async () => {
      await setup({ search: SEARCH });
      respondWith(JSON.stringify([{ _id: 'p1', name: 'From eagle-api' }]));

      const project = await getById('p1', false, null, null);

      expect(project.name).toBe('From eagle-api');
      expect(requestedUrls()[0].startsWith('/api/project/p1?populate=true')).toBe(true);
    });

    it('falls back to eagle-api when DEMI has no record for the project', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(
        new Response('{}', { status: 404, statusText: 'Not Found' }),
        JSON.stringify([{ _id: 'p1', name: 'From eagle-api' }]),
      );

      const project = await getById('p1', false, null, null);

      expect(project.name).toBe('From eagle-api');
      expect(requestedUrls()[0]).toBe(`${DEMI}/p1`);
      expect(requestedUrls()[1].startsWith('/api/project/p1?populate=true')).toBe(true);
    });

    it('falls back to eagle-api when the DEMI read fails outright', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(
        new Response('{}', { status: 500, statusText: 'Internal Server Error' }),
        JSON.stringify([{ _id: 'p1', name: 'From eagle-api' }]),
      );

      const project = await getById('p1', false, null, null);

      expect(project.name).toBe('From eagle-api');
      expect(requestedUrls()[0]).toBe(`${DEMI}/p1`);
      expect(requestedUrls()[1].startsWith('/api/project/p1?populate=true')).toBe(true);
    });
  });

  describe('getProjectPins', () => {
    it('reads the pins off the DEMI project document, sorted by name', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC));

      const response = (await getProjectPins('58851197aaecd9001b8227cc', 1, 100, '+name')) as any;

      expect(response[0].total_items).toBe(3);
      expect(response[0].results.map((pin: any) => pin.name)).toEqual([
        'Esdilagh First Nation',
        'Kwadacha Nation',
        'Tsay Keh Dene Band',
      ]);
      expect(requestedUrls()).toEqual([`${DEMI}/58851197aaecd9001b8227cc`]);
    });

    it('pages the pins the way the eagle-api route does', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(JSON.stringify(DEMI_DOC));

      const response = (await getProjectPins('58851197aaecd9001b8227cc', 2, 1, '+name')) as any;

      expect(response[0].total_items).toBe(3);
      expect(response[0].results.map((pin: any) => pin.name)).toEqual(['Kwadacha Nation']);
    });

    const EAGLE_PINS = JSON.stringify([
      {
        total_items: 1,
        results: [{ _id: 'n1', name: 'Tsay Keh Dene Band', province: 'BC' }],
      },
    ]);

    it('falls back to the eagle-api pin route for a project DEMI has no record of', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(new Response('{}', { status: 404, statusText: 'Not Found' }), EAGLE_PINS);

      const response = (await getPins('p1', 1, 100, '+name')) as any;

      expect(response[0].results.map((pin: any) => pin.name)).toEqual(['Tsay Keh Dene Band']);
      expect(requestedUrls()[0]).toBe(`${DEMI}/p1`);
      expect(requestedUrls()[1]).toBe('/api/project/p1/pin?pageNum=0&pageSize=100&sortBy=+name');
    });

    it('falls back to the eagle-api pin route when the DEMI read fails outright', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      respondWith(
        new Response('{}', { status: 500, statusText: 'Internal Server Error' }),
        EAGLE_PINS,
      );

      const response = (await getProjectPins('p1', 1, 100, '+name')) as any;

      expect(response[0].results.map((pin: any) => pin.name)).toEqual(['Tsay Keh Dene Band']);
      expect(requestedUrls()[0]).toBe(`${DEMI}/p1`);
      expect(requestedUrls()[1]).toBe('/api/project/p1/pin?pageNum=0&pageSize=100&sortBy=+name');
    });

    it('answers an empty list for a DEMI record that carries no pins', async () => {
      await setup({ demi: DEMI, search: SEARCH });
      const { pins: _dropped, ...withoutPins } = DEMI_DOC;
      respondWith(JSON.stringify(withoutPins));

      const response = (await getProjectPins('p1', 1, 100, '+name')) as any;

      expect(response[0].total_items).toBe(0);
      expect(response[0].results).toEqual([]);
      expect(requestedUrls()).toEqual([`${DEMI}/p1`]);
    });

    it('asks the eagle-api pin route when DEMI is not configured', async () => {
      await setup({ search: SEARCH });
      respondWith(JSON.stringify([{ total_items: 0, results: [] }]));

      await getProjectPins('p1', 1, 100, '+name');

      expect(requestedUrls()[0]).toBe('/api/project/p1/pin?pageNum=0&pageSize=100&sortBy=+name');
    });
  });

  describe('getDocumentsByMultiId', () => {
    const ROW = {
      _id: 'd1',
      displayName: 'Application',
      documentFileName: 'application.pdf',
      project: 'p1',
      // demi-search answers the whole indexed row; these two are not in the projection eagle-api
      // was asked for, so they must not survive.
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

    it('projects the demi-search row down to the fields eagle-api was asked for', async () => {
      await setup({ search: SEARCH });
      respondWith(envelope([ROW]));

      const documents = (await getDocumentsByMultiId(['d1'])) as any[];

      expect(documents[0]._id).toBe('d1');
      expect(documents[0].documentFileName).toBe('application.pdf');
      expect(documents[0].projectName).toBeUndefined();
      expect(documents[0].highlighted).toBeUndefined();
    });

    it('asks eagle-api when no search backend is configured', async () => {
      await setup({});
      respondWith(JSON.stringify([ROW]));

      await getDocumentsByMultiId(['d1', 'd2']);

      expect(requestedUrls()[0].startsWith('/api/document?docIds=d1|d2&fields=')).toBe(true);
    });
  });
});
