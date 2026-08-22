import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ProjectService } from './project.service';
import { ApiService } from 'app/services/api';
import { DecisionService } from './decision.service';
import { of, lastValueFrom } from 'rxjs';
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
