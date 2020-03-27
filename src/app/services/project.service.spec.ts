import { TestBed, inject } from '@angular/core/testing';
import { ProjectService } from './project.service';
import { ApiService } from 'app/services/api';
import { DecisionService } from './decision.service';
import { FeatureService } from './feature.service';
import 'rxjs/add/observable/of';
import { Observable } from 'rxjs/Observable';
import { Project } from 'app/models/project';
import { Decision } from 'app/models/decision';
import { Feature } from 'app/models/feature';
import { SearchService } from './search.service';
import { AjaxData } from 'app/shared/utils/mock-data';
import { Utils } from 'app/shared/utils/utils';
import { ISearchResults } from 'app/models/search';
import { Constants } from 'app/shared/utils/constants';

describe('ProjectService', () => {
  let service;
  const apiServiceStub = {
    getProject(id: string) {
      const response = {
        text() {
          return [{_id: id, status: 'ACCEPTED'}];
        }
      };
      return Observable.of(response);
    },

    getProjects() {
      const response = {
        text() {
          return [
            {_id: '58851197aaecd9001b8227cc', status: 'ACCEPTED'},
            {_id: 'BBBB', status: 'OFFERED'}
          ];
        }
      };
      return Observable.of(response);
    },

    getCountProjects() {
      const response = {
        headers: {
          get(name: string) {
            if (name === 'x-total-count') {
              return 300;
            } else {
              return null;
            }
          }
        }
      };
      return Observable.of(response);
    },

    handleError(error: any) {
      fail(error);
    }
  };

  const searchServiceStub = {
    getSearchResults(projectData: Project[]) {
      // Just returning the ajax project for now
      return Observable.of(projectData);
    },
    // Returning null for now on the getItem call
    getItem(string: String) {
      return Observable.of({data: string})
    }
  };

  const utilsStub = {
    extractFromSearchResults(obj: ISearchResults<Project>[]) {
      return obj;
    },
    natureBuildMapper(key: String) {
      if (!key) {
        return '';
      }
      const natureObj = Constants.buildToNature.find(obj => obj.build === key);
      return (natureObj) ? natureObj.nature : key;
    }
  }
  const decisionServiceStub = {
    getByProjectId() {
      return Observable.of(new Decision({_id: 'IIIII'}));
    }
  };

  const featureServiceStub = {
    getByProjectId() {
      const features = [
        new Feature({id: 'FFFFF', properties: { TENURE_AREA_IN_HECTARES: 12 }}),
        new Feature({id: 'GGGGG', properties: { TENURE_AREA_IN_HECTARES: 13 }})
      ];
      return Observable.of(features);
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProjectService,
        { provide: ApiService, useValue: apiServiceStub },
        { provide: SearchService, useValue: searchServiceStub },
        { provide: Utils, useValue: utilsStub },
        { provide: DecisionService, useValue: decisionServiceStub },
        { provide: FeatureService, useValue: featureServiceStub },
      ]
    });

    service = TestBed.get(ProjectService);
  });

  it('should be created', inject([ProjectService], (appService: ProjectService) => {
    expect(appService).toBeTruthy();
  }));

  describe('getById()', () => {
    let apiService;
    const freshProjectData: Project = AjaxData[0];
    const freshProjectArray: Project[] = AjaxData;

    beforeEach(() => {
      apiService = TestBed.get(ApiService);

      const response = freshProjectArray;

      spyOn(apiService, 'getProject')
        .and.returnValue(Observable.of(response));
    });

    describe('when an project has been cached', () => {
      const cachedProject = new Project({_id: '58851197aaecd9001b8227cc', description: 'Old outdated project'});
      beforeEach(() => {
        service.project = cachedProject;
      });

      describe('and forceReload is false', () => {
        it('returns the cached project', () => {
          service.getById('58851197aaecd9001b8227cc', false).subscribe(project => {
            expect(project._id).toEqual('58851197aaecd9001b8227cc');
            expect(project.description).toEqual('Old outdated project');
          });
        });
      });

      describe('and forceReload is true', () => {
        it('calls the api for an project', () => {
          service.getById('58851197aaecd9001b8227cc', true).subscribe(project => {
            expect(project._id).toEqual('58851197aaecd9001b8227cc');
            expect(project.description).toEqual('KGHM Ajax Mining Inc.  proposes to develop a new open-pit copper and gold mine with a production capacity of up to 24 million tonnes of ore per year. The mine\'s life expectancy is 23 years.');
          });
        });
      });
    });

    describe('when no project has been cached', () => {
      beforeEach(() => {
        service.project = null;
      });

      it('calls the api for an project', () => {
        service.getById('58851197aaecd9001b8227cc', false).subscribe(project => {
          expect(project._id).toEqual('58851197aaecd9001b8227cc');
          expect(project.description).toEqual('KGHM Ajax Mining Inc.  proposes to develop a new open-pit copper and gold mine with a production capacity of up to 24 million tonnes of ore per year. The mine\'s life expectancy is 23 years.');
        });
      });

      describe('project properties', () => {
        it('sets the appStatus property', () => {
          freshProjectData.build = 'new';
          service.getById('58851197aaecd9001b8227cc').subscribe( project => {
            expect(project.nature).toBe(utilsStub.natureBuildMapper('new'));
          });
        });
      });
    });
  });
});
