import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import { ApiService } from 'app/services/api';
import { defer, of, lastValueFrom, firstValueFrom } from 'rxjs';
import { Project } from 'app/models/project';
import { SearchService } from './search.service';
// Mock data removed - simplified tests
import { Utils } from 'app/shared/utils/utils';
import { Constants } from 'app/shared/utils/constants';
import { LoggingService } from './logging.service';
import { ConfigService } from './config.service';
import { DEMI_PROJECTS, envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockApiService: any;
  let mockSearchService: any;
  let mockUtils: any;

  beforeEach(() => {
    mockApiService = {
      getProject: vi.fn((id: string) => {
        return of([{ _id: id, status: 'ACCEPTED' }]);
      }),
      getProjects: vi.fn(() => {
        return of([
          { _id: '58851197aaecd9001b8227cc', status: 'ACCEPTED' },
          { _id: 'BBBB', status: 'OFFERED' }
        ]);
      }),
      getCountProjects: vi.fn(() => of(300)),
      handleError: vi.fn()
    };

    mockSearchService = {
      getSearchResults: vi.fn((projectData: Project[]) => of(projectData)),
    };

    mockUtils = {
      extractFromSearchResults: vi.fn((obj: any) => obj),
      natureBuildMapper: vi.fn((key: string) => {
        if (!key) return '';
        const natureObj = Constants.buildToNature.find(obj => obj.build === key);
        return natureObj ? natureObj.nature : key;
      })
    };

    TestBed.configureTestingModule({
      providers: [
        ProjectService,
        { provide: ApiService, useValue: mockApiService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: Utils, useValue: mockUtils }
      ]
    });

    service = TestBed.inject(ProjectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAll()', () => {
    // demi-api answers non-2xx when a search fails, and search.service.getSearchResults turns
    // any non-2xx into a single `null` (search.service.ts:65-69). getAll used to dereference
    // res[0].data.meta[0].searchResultsTotal on that, throwing a TypeError which api.handleError
    // re-threw (api.ts:74-78) into projects.component.ts:130-135 -> router.navigate(['/']).
    // Returning null here is what the real Utils does for these responses - see utils.spec.ts.
    beforeEach(() => {
      mockUtils.extractFromSearchResults.mockReturnValue(null);
    });

    it('degrades a failed search to an empty result set instead of throwing', async () => {
      mockSearchService.getSearchResults.mockReturnValue(of(null));

      const result: any = await lastValueFrom(service.getAll(1, 10));

      expect(result.data).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('degrades a response with no meta block to an empty result set', async () => {
      // A well-formed but meta-less envelope: the extractor is happy, meta[0] is what blows up.
      mockUtils.extractFromSearchResults.mockReturnValue([]);
      mockSearchService.getSearchResults.mockReturnValue(of([{ data: { searchResults: [] } }]));

      const result: any = await lastValueFrom(service.getAll(1, 10));

      expect(result.data).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('logs the failure rather than surfacing it silently', async () => {
      const logSpy = vi.spyOn(TestBed.inject(LoggingService), 'error').mockImplementation(() => undefined);
      mockSearchService.getSearchResults.mockReturnValue(of(null));

      await lastValueFrom(service.getAll(1, 10));

      expect(logSpy).toHaveBeenCalled();
    });

    it('still reports the total count for a well-formed response', async () => {
      mockUtils.extractFromSearchResults.mockReturnValue([{ _id: 'abc' }]);
      mockSearchService.getSearchResults.mockReturnValue(
        of([{ data: { searchResults: [{ _id: 'abc' }], meta: [{ searchResultsTotal: 42 }] } }])
      );

      const result: any = await lastValueFrom(service.getAll(1, 10));

      expect(result.totalCount).toBe(42);
      expect(result.data.length).toBe(1);
    });
  });

  describe('getAllFull()', () => {
    // The visitor-visible symptom: the TypeError escaped both catchErrors and reached the
    // error handler in projects.component.ts, which bounces the visitor off /projects.
    it('emits an empty project list rather than erroring when the search fails', async () => {
      mockUtils.extractFromSearchResults.mockReturnValue(null);
      mockSearchService.getSearchResults.mockReturnValue(of(null));
      vi.spyOn(TestBed.inject(LoggingService), 'error').mockImplementation(() => undefined);

      await expect(lastValueFrom(service.getAllFull(1, 10))).resolves.toEqual([]);
    });
  });

  describe('getById()', () => {
    it('calls the api for a project', async () => {
      const mockProject = [new Project({ _id: '58851197aaecd9001b8227cc', description: 'Test project' })];
      mockApiService.getProject.mockReturnValue(of(mockProject));

      const project = await firstValueFrom(service.getById('58851197aaecd9001b8227cc', true));

      expect(project._id).toEqual('58851197aaecd9001b8227cc');
      expect(mockApiService.getProject).toHaveBeenCalled();
    });

    it('calls the api when forceReload is true', async () => {
      const mockProject = [new Project({ _id: 'test-id', description: 'Test' })];
      mockApiService.getProject.mockReturnValue(of(mockProject));

      await firstValueFrom(service.getById('test-id', true));

      expect(mockApiService.getProject).toHaveBeenCalled();
    });
  });
});

/**
 * The project page reads `GET /demi-projects/<id>` and maps it to the shape eagle-api answered.
 * Real ApiService over HttpTestingController, so the URL, the mapping and the 404 are exercised.
 */
describe('ProjectService DEMI project reads', () => {
  const PROJECT_ID = '60f078d3332ebd0022a39224';
  const DOC = {
    _id: 'demi-uuid',
    eagleId: PROJECT_ID,
    name: 'Eskay Creek',
    projectType: 'Mines',
    projectState: 'Active',
    address: 'Near Stewart',
    centroid: { type: 'Point', coordinates: [-130.4, 56.6] },
    proponentId: '5c8a7b6d5e4f3a2b1c0d9e8f',
    proponentName: 'Skeena Resources Limited',
    eacDecision: 'list-approved',
    pins: [
      { _id: 'n2', name: 'Tahltan Central Government' },
      { _id: 'n1', name: 'Nisga\'a Lisims Government' },
      { _id: 'n3', name: 'Gitanyow Hereditary Chiefs' },
    ],
  };
  const LISTS = [{ _id: 'list-approved', name: 'Certificate Issued', type: 'eacDecision' }];
  let httpMock: HttpTestingController;
  let service: ProjectService;

  beforeEach(() => {
    httpMock = setupDemiApi([{ provide: Utils, useValue: { natureBuildMapper: () => '' } }], LISTS);
    service = TestBed.inject(ProjectService);
  });

  afterEach(() => httpMock.verify());

  function projectRequest() {
    return httpMock.expectOne(`${DEMI_PROJECTS}/${PROJECT_ID}`);
  }

  it('reads the project from /demi-projects by its Eagle id', async () => {
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush(DOC);
    expect((await project)._id).toBe(PROJECT_ID);
  });

  it("maps Track's field names onto the Eagle ones", async () => {
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush(DOC);
    const result = await project;
    expect(result.type).toBe('Mines');
    expect(result.status).toBe('Active');
    expect(result.location).toBe('Near Stewart');
  });

  it('flattens the GeoJSON centroid for the map', async () => {
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush(DOC);
    expect((await project).centroid).toEqual([-130.4, 56.6]);
  });

  it('rebuilds the proponent from its id and name', async () => {
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush(DOC);
    expect((await project).proponent).toEqual({ _id: DOC.proponentId, name: 'Skeena Resources Limited' });
  });

  it('resolves a List id to its row', async () => {
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush(DOC);
    expect((await project).eacDecision?.name).toBe('Certificate Issued');
  });

  it('uses List fields DEMI already populated without reading the List rows', async () => {
    let listReads = 0;
    (TestBed.inject(ConfigService) as any).lists = defer(() => { listReads++; return of(LISTS); });
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush({
      ...DOC,
      eacDecision: { _id: 'd', name: 'Certificate Issued' },
      currentPhaseName: { _id: 'p', name: 'Post-Certificate' },
      CEAAInvolvement: { _id: 'c', name: 'None' },
    });
    const result = await project;
    expect([result.eacDecision?.name, result.currentPhaseName?.name, result.CEAAInvolvement?.name])
      .toEqual(['Certificate Issued', 'Post-Certificate', 'None']);
    expect(listReads).toBe(0);
  });

  it('leaves a List id with no matching row empty, so the page shows "-"', async () => {
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush({ ...DOC, eacDecision: 'list-unknown' });
    expect((await project).eacDecision).toBeNull();
  });

  it('answers null, not an error, when DEMI has no such project', async () => {
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    expect(await project).toBeNull();
  });

  it('fails on any other DEMI error', async () => {
    vi.spyOn(TestBed.inject(LoggingService), 'error').mockImplementation(() => undefined);
    const project = firstValueFrom(service.getById(PROJECT_ID, true));
    projectRequest().flush({ message: 'down' }, { status: 502, statusText: 'Bad Gateway' });
    await expect(project).rejects.toBeTruthy();
  });

  describe('comment period banner', () => {
    const START = '2026-09-01T00:00:00.000Z';
    const END = '2026-10-31T00:00:00.000Z';

    it("reads the project's periods by and[project]", async () => {
      const project = firstValueFrom(service.getById(PROJECT_ID, true, START, END));
      projectRequest().flush(DOC);
      const req = searchRequest(httpMock, 'CommentPeriod');
      expect(req.request.url).toContain(`&and[project]=${PROJECT_ID}`);
      req.flush(envelope([]));
      await project;
    });

    it('shows a period that falls inside the window', async () => {
      const project = firstValueFrom(service.getById(PROJECT_ID, true, START, END));
      projectRequest().flush(DOC);
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([
        { _id: 'old', informationLabel: 'Old', dateStarted: '2025-01-01T00:00:00Z', dateCompleted: '2025-02-01T00:00:00Z' },
        { _id: 'cur', informationLabel: 'Current', dateStarted: '2026-09-15T00:00:00Z', dateCompleted: '2026-10-15T00:00:00Z' },
      ]));
      expect((await project).commentPeriodForBanner?.informationLabel).toBe('Current');
    });

    it('shows a period that spans the window', async () => {
      const project = firstValueFrom(service.getById(PROJECT_ID, true, START, END));
      projectRequest().flush(DOC);
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([
        { _id: 'long', informationLabel: 'Long', dateStarted: '2026-08-01T00:00:00Z', dateCompleted: '2026-11-30T00:00:00Z' },
      ]));
      expect((await project).commentPeriodForBanner?.informationLabel).toBe('Long');
    });

    it('shows no banner when the window cannot be read', async () => {
      const project = firstValueFrom(service.getById(PROJECT_ID, true, 'not a date', END));
      projectRequest().flush(DOC);
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([
        { _id: 'cur', informationLabel: 'Current', dateStarted: '2026-09-15T00:00:00Z', dateCompleted: '2026-10-15T00:00:00Z' },
      ]));
      expect((await project).commentPeriodForBanner).toBeNull();
    });

    it('shows no banner for a period whose dates cannot be read', async () => {
      const project = firstValueFrom(service.getById(PROJECT_ID, true, START, END));
      projectRequest().flush(DOC);
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([
        { _id: 'bad', informationLabel: 'Bad', dateStarted: 'soon', dateCompleted: null },
      ]));
      expect((await project).commentPeriodForBanner).toBeNull();
    });

    it('shows no banner for a period outside the window', async () => {
      const project = firstValueFrom(service.getById(PROJECT_ID, true, START, END));
      projectRequest().flush(DOC);
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([
        { _id: 'old', informationLabel: 'Old', dateStarted: '2025-01-01T00:00:00Z', dateCompleted: '2025-02-01T00:00:00Z' },
      ]));
      expect((await project).commentPeriodForBanner).toBeNull();
    });

    it('still loads the project when the period read fails', async () => {
      const project = firstValueFrom(service.getById(PROJECT_ID, true, START, END));
      projectRequest().flush(DOC);
      searchRequest(httpMock, 'CommentPeriod').flush({}, { status: 500, statusText: 'Server Error' });
      const result = await project;
      expect(result._id).toBe(PROJECT_ID);
      expect(result.commentPeriodForBanner).toBeNull();
    });
  });

  describe('getPins()', () => {
    it('pages and sorts the pins carried on the project document', async () => {
      const pins = firstValueFrom(service.getPins(PROJECT_ID, 1, 2, '+name'));
      projectRequest().flush(DOC);
      const [page] = await pins as any[];
      expect(page.total_items).toBe(3);
      expect(page.results.map((pin: any) => pin._id)).toEqual(['n3', 'n1']);
    });

    it('sorts the pins by name, descending', async () => {
      const pins = firstValueFrom(service.getPins(PROJECT_ID, 1, 10, '-name'));
      projectRequest().flush(DOC);
      const [page] = await pins as any[];
      expect(page.results.map((pin: any) => pin._id)).toEqual(['n2', 'n1', 'n3']);
    });

    it('answers every pin when no page size is given', async () => {
      const pins = firstValueFrom(service.getPins(PROJECT_ID, 1, null as unknown as number, '+name'));
      projectRequest().flush(DOC);
      const [page] = await pins as any[];
      expect(page.results.map((pin: any) => pin._id)).toEqual(['n3', 'n1', 'n2']);
    });

    it('answers an empty page past the last one, with the full total', async () => {
      const pins = firstValueFrom(service.getPins(PROJECT_ID, 3, 2, '+name'));
      projectRequest().flush(DOC);
      const [page] = await pins as any[];
      expect(page.total_items).toBe(3);
      expect(page.results).toEqual([]);
    });

    it('answers no pins when DEMI has no such project', async () => {
      const pins = firstValueFrom(service.getPins(PROJECT_ID, 1, 10, ''));
      projectRequest().flush({}, { status: 404, statusText: 'Not Found' });
      const [page] = await pins as any[];
      expect(page.total_items).toBe(0);
    });
  });
});
