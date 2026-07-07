import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ProjectService } from './project.service';
import { ApiService } from 'app/services/api';
import { DecisionService } from './decision.service';
import { of } from 'rxjs';
import { Project } from 'app/models/project';
import { Decision } from 'app/models/decision';
import { SearchService } from './search.service';
// Mock data removed - simplified tests
import { Utils } from 'app/shared/utils/utils';
import { Constants } from 'app/shared/utils/constants';

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
