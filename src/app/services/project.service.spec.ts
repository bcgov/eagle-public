import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import { ApiService } from 'app/services/api';
import { ConfigService } from './config.service';
import { AnalyticsService } from './analytics/analytics.service';
import { DecisionService } from './decision.service';
import { of, lastValueFrom, firstValueFrom } from 'rxjs';
import { Project } from 'app/models/project';
import { Decision } from 'app/models/decision';
import { SearchService } from './search.service';
// Mock data removed - simplified tests
import { Utils } from 'app/shared/utils/utils';
import { Constants } from 'app/shared/utils/constants';
import { LoggingService } from './logging.service';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockApiService: any;
  let mockSearchService: any;
  let mockUtils: any;
  let mockDecisionService: any;

  beforeEach(() => {
    mockApiService = {
      getProject: vi.fn((id: string) => {
        return of([{ _id: id, status: 'ACCEPTED' }]);
      }),
      getDemiProponentName: vi.fn(() => of(null)),
      getProjects: vi.fn(() => {
        return of([
          { _id: '58851197aaecd9001b8227cc', status: 'ACCEPTED' },
          { _id: 'BBBB', status: 'OFFERED' }
        ]);
      }),
      getCountProjects: vi.fn(() => {
        return of({
          headers: {
            get: (name: string) => (name === 'x-total-count' ? 300 : null)
          }
        });
      }),
      handleError: vi.fn()
    };

    mockSearchService = {
      getSearchResults: vi.fn((projectData: Project[]) => of(projectData)),
      getItem: vi.fn((string: string) => of({ data: string }))
    };

    mockUtils = {
      extractFromSearchResults: vi.fn((obj: any) => obj),
      natureBuildMapper: vi.fn((key: string) => {
        if (!key) return '';
        const natureObj = Constants.buildToNature.find(obj => obj.build === key);
        return natureObj ? natureObj.nature : key;
      })
    };

    mockDecisionService = {
      getByProjectId: vi.fn(() => of(new Decision({ _id: 'IIIII' })))
    };

    TestBed.configureTestingModule({
      providers: [
        ProjectService,
        { provide: ApiService, useValue: mockApiService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: Utils, useValue: mockUtils },
        { provide: DecisionService, useValue: mockDecisionService }
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
    it('calls the api for a project', () => {
      const mockProject = [new Project({ _id: '58851197aaecd9001b8227cc', description: 'Test project' })];
      mockApiService.getProject.mockReturnValue(of(mockProject));

      service.getById('58851197aaecd9001b8227cc', true).subscribe(project => {
        expect(project._id).toEqual('58851197aaecd9001b8227cc');
        expect(mockApiService.getProject).toHaveBeenCalled();
      });
    });

    it('calls the api when forceReload is true', () => {
      const mockProject = [new Project({ _id: 'test-id', description: 'Test' })];
      mockApiService.getProject.mockReturnValue(of(mockProject));

      service.getById('test-id', true).subscribe(_project => {
        expect(mockApiService.getProject).toHaveBeenCalled();
      });
    });
  });
});

/**
 * The project detail page shows DEMI's proponent name, the same one the project list shows.
 *
 * Eagle Mongo and DEMI disagree for some projects because DEMI merges Track in and lets Track win.
 * Only the name comes from DEMI; the Eagle org _id stays because the proponent filter keys on it.
 * DEMI must never break or hold up the page: any failure keeps the Eagle value. Real ApiService
 * over HttpTestingController, so the DEMI query and the fallbacks are exercised end to end.
 */
describe('ProjectService.getById DEMI proponent name', () => {
  const SEARCH = 'https://demi.example/demi-search';
  const PROJECT_ID = '60f078d3332ebd0022a39224';
  const EAGLE_ORG = { _id: '5c8a7b6d5e4f3a2b1c0d9e8f', name: 'Skeena Resources Limited' };
  let httpMock: HttpTestingController;

  function setup(searchApiPath: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService,
        ProjectService,
        {
          provide: ConfigService,
          useValue: {
            getApiPath: () => '/api',
            getSearchApiPath: () => searchApiPath || '/api',
            config: () => ({}),
          },
        },
        { provide: LoggingService, useValue: { debug: vi.fn(), trace: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() } },
        { provide: SearchService, useValue: {} },
        { provide: AnalyticsService, useValue: { track: vi.fn() } },
        { provide: Utils, useValue: { natureBuildMapper: () => '' } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(ProjectService);
  }

  function load(service: ProjectService): Promise<Project> {
    return firstValueFrom(service.getById(PROJECT_ID, true));
  }

  function demiRequest(): TestRequest {
    return httpMock.expectOne(req => req.url.startsWith(`${SEARCH}/search?dataset=Project`));
  }

  function flushEagle() {
    httpMock.expectOne(req => req.url.startsWith(`/api/project/${PROJECT_ID}`))
      .flush([{ _id: PROJECT_ID, name: 'Eskay Creek', proponent: { ...EAGLE_ORG } }]);
  }

  function demiRow(proponentName: string, id = PROJECT_ID) {
    return [{ searchResults: [{ _id: id, _schemaName: 'Project', proponent: { _id: null, name: proponentName } }], meta: [] }];
  }

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('asks DEMI for the one project by its Eagle id', async () => {
    const service = setup(SEARCH);
    const project = load(service);
    const req = demiRequest();
    expect(req.request.url).toContain(`and[_id]=${PROJECT_ID}`);
    expect(req.request.url).toContain('pageSize=1');
    req.flush(demiRow('Eskay Creek Mining Ltd.'));
    flushEagle();
    await project;
  });

  it('shows the DEMI name and keeps the Eagle proponent _id', async () => {
    const service = setup(SEARCH);
    const project = load(service);
    demiRequest().flush(demiRow('Eskay Creek Mining Ltd.'));
    flushEagle();

    const result = await project;
    expect(result.proponent.name).toBe('Eskay Creek Mining Ltd.');
    expect(result.proponent._id).toBe(EAGLE_ORG._id);
  });

  it('keeps the Eagle name when the DEMI call fails', async () => {
    const service = setup(SEARCH);
    const project = load(service);
    demiRequest().flush({ message: 'Project search is unavailable' }, { status: 502, statusText: 'Bad Gateway' });
    flushEagle();

    expect((await project).proponent).toEqual(EAGLE_ORG);
  });

  it('keeps the Eagle name when DEMI has no matching row', async () => {
    const service = setup(SEARCH);
    const project = load(service);
    demiRequest().flush([{ searchResults: [], count: 0 }]);
    flushEagle();

    expect((await project).proponent).toEqual(EAGLE_ORG);
  });

  it('ignores a DEMI row for a different project', async () => {
    const service = setup(SEARCH);
    const project = load(service);
    demiRequest().flush(demiRow('Some Other Proponent', '000000000000000000000000'));
    flushEagle();

    expect((await project).proponent).toEqual(EAGLE_ORG);
  });

  it("ignores DEMI's placeholder name for a project with no proponent", async () => {
    const service = setup(SEARCH);
    const project = load(service);
    demiRequest().flush(demiRow('Proponent Organization'));
    flushEagle();

    expect((await project).proponent).toEqual(EAGLE_ORG);
  });

  it('gives up on a slow DEMI call and shows the Eagle name', async () => {
    vi.useFakeTimers();
    const service = setup(SEARCH);
    const project = load(service);
    demiRequest(); // never answered
    flushEagle();
    await vi.advanceTimersByTimeAsync(3000);

    expect((await project).proponent).toEqual(EAGLE_ORG);
  });

  // Kill switch: with SEARCH_API_PATH empty, search is eagle-api, so there is nothing to overlay.
  it('makes no DEMI call and keeps the Eagle name when SEARCH_API_PATH is empty', async () => {
    const service = setup('');
    const project = load(service);
    flushEagle();
    httpMock.expectNone(req => req.url.includes('/search?'));

    expect((await project).proponent).toEqual(EAGLE_ORG);
  });
});
