import { TestBed, inject } from '@angular/core/testing';
import { ProjectService } from './project.service';
import { ApiService } from 'app/services/api';
import { DocumentService } from './document.service';
import { CommentPeriodService } from './commentperiod.service';
import { DecisionService } from './decision.service';
import { FeatureService } from './feature.service';
import 'rxjs/add/observable/of';
import { Observable } from 'rxjs/Observable';
import { Project } from 'app/models/project';
import { Document } from 'app/models/document';
import { CommentPeriod } from 'app/models/commentperiod';
import { Decision } from 'app/models/decision';
import { Feature } from 'app/models/feature';

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
            {_id: 'AAAA', status: 'ACCEPTED'},
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

  const documentServiceStub = {
    getAllByProjectId(projectId: string) {
      const documents = [
        new Document({_id: 'DDDDD'}),
        new Document({_id: 'EEEEE'})
      ];
      return Observable.of(documents);
    }
  };

  const commentPeriodServiceStub = {
    getAllByProjectId(projectId: string) {
      const commentPeriods = [
        new CommentPeriod({_id: 'DDDDD', startDate: new Date(2018, 10, 1, ), endDate: new Date(2018, 11, 10)}),
        new CommentPeriod({_id: 'EEEEE', startDate: new Date(2018, 10, 1, ), endDate: new Date(2018, 11, 10)})
      ];
      return Observable.of(commentPeriods);
    },

    getCurrent(periods: CommentPeriod[]): CommentPeriod {
      return (periods.length > 0) ? periods[0] : null;
    },

    getStatusCode(commentPeriod: CommentPeriod): string {
      return 'OP';
    },

    getStatusString(statusCode: string): string {
      return 'Commenting Open';
    }
  };

  const decisionServiceStub = {
    getByProjectId(projectId: string) {
      return Observable.of(new Decision({_id: 'IIIII'}));
    }
  };

  const featureServiceStub = {
    getByProjectId(projectId: string) {
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
        { provide: DocumentService, useValue: documentServiceStub },
        { provide: CommentPeriodService, useValue: commentPeriodServiceStub },
        { provide: DecisionService, useValue: decisionServiceStub },
        { provide: FeatureService, useValue: featureServiceStub },
      ]
    });

    service = TestBed.get(ProjectService);
  });

  it('should be created', inject([ProjectService], (appService: ProjectService) => {
    expect(appService).toBeTruthy();
  }));

  describe('getCount()', () => {
    it('retrieves the x-total-count header', () => {
      service.getCount().subscribe(number => {
        expect(number).toEqual(300);
      });
    });
  });

  describe('getAll()', () => {
    let apiService;
    const existingProjectsData = [
      {
        _id: 'AAAA', status: 'ACCEPTED', description: 'Wonderful project',
        cl_file: null, businessUnit: null
      },
      {
        _id: 'BBBB', status: 'ABANDONED', description: 'Terrible project',
        cl_file: null, businessUnit: null
      },
    ];

    beforeEach(() => {
      apiService = TestBed.get(ApiService);

      const response = {
        text() {
          return existingProjectsData;
        },
        json() {
          return existingProjectsData;
        }
      };

      spyOn(apiService, 'getProjects')
        .and.returnValue(Observable.of(response));
    });

    describe('with no filters', () => {
      it('returns the projects', () => {
        service.getAll().subscribe(projects => {
          expect(projects[0]._id).toEqual('AAAA');
          expect(projects[1]._id).toEqual('BBBB');
        });
      });
    });

    describe('with region filters', () => {
      xit('calls the api.getProjects method with the region filters', () => {
        service.getAll(1, 100, {});
      });
    });
  });

  describe('getById()', () => {
    let apiService;
    const freshProjectData = {
      _id: 'AAAA', status: 'ACCEPTED', description: 'Hot new project',
      cl_file: null, businessUnit: null
    };

    beforeEach(() => {
      apiService = TestBed.get(ApiService);

      const response = {
        text() {
          return [freshProjectData];
        },
        json() {
          return [freshProjectData];
        }
      };

      spyOn(apiService, 'getProject')
        .and.returnValue(Observable.of(response));
    });

    describe('when an project has been cached', () => {
      const cachedProject = new Project({_id: 'AAAA', description: 'Old outdated project'});
      beforeEach(() => {
        service.project = cachedProject;
      });

      describe('and forceReload is false', () => {
        it('returns the cached project', () => {
          service.getById('AAAA', false).subscribe(project => {
            expect(project._id).toEqual('AAAA');
            expect(project.description).toEqual('Old outdated project');
          });
        });
      });

      describe('and forceReload is true', () => {
        it('calls the api for an project', () => {
          service.getById('AAAA', true).subscribe(project => {
            expect(project._id).toEqual('AAAA');
            expect(project.description).toEqual('Hot new project');
          });
        });
      });
    });

    describe('when no project has been cached', () => {
      beforeEach(() => {
        service.project = null;
      });

      it('calls the api for an project', () => {
        service.getById('AAAA', false).subscribe(project => {
          expect(project._id).toEqual('AAAA');
          expect(project.description).toEqual('Hot new project');
        });
      });

      describe('project properties', () => {
        it('sets the appStatus property', () => {
          freshProjectData.status = 'ACCEPTED';
          service.getById('AAAA').subscribe( project => {
            expect(project.appStatus).toBe('Project Under Review');
          });
        });

        it('clFile property is padded to be seven digits', () => {
          freshProjectData.cl_file = 7777;
          service.getById('AAAA').subscribe( project => {
            expect(project.clFile).toBe('0007777');
          });
        });

        it('clFile property is null if there is no cl_file property', () => {
          freshProjectData.cl_file = null;
          service.getById('AAAA').subscribe( project => {
            expect(project.clFile).toBeUndefined();
          });
        });

        it('sets the region property', () => {
          freshProjectData.businessUnit = 'ZOO Keeper';
          service.getById('AAAA').subscribe( project => {
            expect(project.region).toBeDefined();
            expect(project.region).toEqual('ZOO');
          });
        });
      });

      it('sets the documents to the result of the document service', () => {
        service.getById('AAAA').subscribe( project => {
          expect(project.documents).toBeDefined();
          expect(project.documents).not.toBeNull();
          expect(project.documents[0]._id).toBe('DDDDD');
          expect(project.documents[1]._id).toBe('EEEEE');
        });
      });

      it('gets the commentPeriods for the project, sets the current period and cpStatus ', () => {
        service.getById('AAAA').subscribe( project => {
          expect(project.currentPeriod).toBeDefined();
          expect(project.currentPeriod).not.toBeNull();
          expect(project.currentPeriod._id).toBe('DDDDD');
        });
      });

      it('sets the commentPeriod status', () => {
        service.getById('AAAA').subscribe( project => {
          expect(project.cpStatus).toEqual('Commenting Open');
        });
      });

      it('sets the decisions to the result of the decisionService', () => {
        service.getById('AAAA').subscribe( project => {
          expect(project.decision).toBeDefined();
          expect(project.decision).not.toBeNull();
          expect(project.decision._id).toBe('IIIII');
        });
      });

      it('sets the features to the result of the featureService', () => {
        service.getById('AAAA').subscribe( project => {
          expect(project.features).toBeDefined();
          expect(project.features).not.toBeNull();
          expect(project.features[0].id).toBe('FFFFF');
          expect(project.features[1].id).toBe('GGGGG');
        });
      });
    });
  });

  describe('getStatusString()', () => {
    it('with "AB" code it returns "Project Abandoned"', () => {
      expect(service.getStatusString('AB')).toBe('Project Abandoned');
    });

    it('with "AC" code it returns "Project Under Review', () => {
      expect(service.getStatusString('AC')).toBe('Project Under Review');
    });

    it('with "AL" code it returns "Decision: Allowed', () => {
      expect(service.getStatusString('AL')).toBe('Decision: Allowed');
    });

    it('with "CA" code it returns "Project Cancelled', () => {
      expect(service.getStatusString('CA')).toBe('Project Cancelled');
    });

    it('with "DE" code it returns "Decision Made', () => {
      expect(service.getStatusString('DE')).toBe('Decision Made');
    });

    it('with "DI" code it returns "Decision: Not Approved', () => {
      expect(service.getStatusString('DI')).toBe('Decision: Not Approved');
    });

    it('with "DG" code it returns "Tenure: Disposition in Good Standing', () => {
      expect(service.getStatusString('DG')).toBe('Tenure: Disposition in Good Standing');
    });

    it('with "OA" code it returns "Decision: Offer Accepted', () => {
      expect(service.getStatusString('OA')).toBe('Decision: Offer Accepted');
    });

    it('with "ON" code it returns "Decision: Offer Not Accepted', () => {
      expect(service.getStatusString('ON')).toBe('Decision: Offer Not Accepted');
    });

    it('with "OF" code it returns "Decision: Offered', () => {
      expect(service.getStatusString('OF')).toBe('Decision: Offered');
    });

    it('with "SU" code it returns "Tenure: Suspended', () => {
      expect(service.getStatusString('SU')).toBe('Tenure: Suspended');
    });

    it('with "UN" code it returns "Unknown Project Status', () => {
      expect(service.getStatusString('UN')).toBe('Unknown Project Status');
    });

    it('returns the code that was passed in if it is not recognized', () => {
      expect(service.getStatusString('WOO_BOY')).toBe('WOO_BOY');
    });
  });

  describe('getStatusCode()', () => {
    it('with "ABANDONED" status it returns "AB" code', () => {
      expect(service.getStatusCode('ABANDONED')).toBe('AB');
    });

    it('with "ACCEPTED" status it returns "AC" code', () => {
      expect(service.getStatusCode('ACCEPTED')).toBe('AC');
    });

    it('with "ALLOWED" status it returns "AL" code', () => {
      expect(service.getStatusCode('ALLOWED')).toBe('AL');
    });

    it('with "CANCELLED" status it returns "CA" code', () => {
      expect(service.getStatusCode('CANCELLED')).toBe('CA');
    });

    it('with "DISALLOWED" status it returns "DI" code', () => {
      expect(service.getStatusCode('DISALLOWED')).toBe('DI');
    });

    it('with "DISPOSITION IN GOOD STANDING" status it returns "DG" code', () => {
      expect(service.getStatusCode('DISPOSITION IN GOOD STANDING')).toBe('DG');
    });

    it('with "OFFER ACCEPTED" status it returns "OA" code', () => {
      expect(service.getStatusCode('OFFER ACCEPTED')).toBe('OA');
    });

    it('with "OFFER NOT ACCEPTED" status it returns "ON" code', () => {
      expect(service.getStatusCode('OFFER NOT ACCEPTED')).toBe('ON');
    });

    it('with "OFFERED" status it returns "OF" code', () => {
      expect(service.getStatusCode('OFFERED')).toBe('OF');
    });

    it('with "SUSPENDED" status it returns "SU" code', () => {
      expect(service.getStatusCode('SUSPENDED')).toBe('SU');
    });

    it('returns "UN" if no status passed', () => {
      expect(service.getStatusCode('')).toBe('UN');
    });

    it('returns "UN" if the passed in status is undefined', () => {
      const undefinedStatus = undefined;
      expect(service.getStatusCode(undefinedStatus)).toBe('UN');
    });

    it('returns the status back if it is not recognized', () => {
      expect(service.getStatusCode('WOO_BOY')).toBe('Woo Boy');
    });
  });

  describe('isDecision()', () => {
    it('returns false for the non-decision statuses', () => {
      ['AB', 'AC', 'DE', 'SU', 'UN'].forEach(status => {
        expect(service.isDecision(status)).toBe(false);
      });
    });

    it('returns true for the decision statuses', () => {
      ['AL', 'CA', 'DI', 'DG', 'OA', 'ON', 'OF'].forEach(status => {
        expect(service.isDecision(status)).toBe(true);
      });
    });
  });

  describe('getRegionString()', () => {
    it('with "CA" code it returns "Cariboo, Williams Lake"', () => {
      expect(service.getRegionString('CA')).toBe('Cariboo, Williams Lake');
    });

    it('with "KO" code it returns "Kootenay, Cranbrook"', () => {
      expect(service.getRegionString('KO')).toBe('Kootenay, Cranbrook');
    });

    it('with "LM" code it returns "Lower Mainland, Surrey"', () => {
      expect(service.getRegionString('LM')).toBe('Lower Mainland, Surrey');
    });

    it('with "OM" code it returns "Omenica/Peace, Prince George"', () => {
      expect(service.getRegionString('OM')).toBe('Omenica/Peace, Prince George');
    });

    it('with "PE" code it returns "Peace, Ft. St. John"', () => {
      expect(service.getRegionString('PE')).toBe('Peace, Ft. St. John');
    });

    it('with "SK" code it returns "Skeena, Smithers"', () => {
      expect(service.getRegionString('SK')).toBe('Skeena, Smithers');
    });

    it('with "SI" code it returns "Thompson Okanagan, Kamloops"', () => {
      expect(service.getRegionString('SI')).toBe('Thompson Okanagan, Kamloops');
    });

    it('with "VI" code it returns "West Coast, Nanaimo"', () => {
      expect(service.getRegionString('VI')).toBe('West Coast, Nanaimo');
    });

    it('returns "undefined" if code is not recognized', () => {
      expect(service.getRegionString('WUT')).toBeUndefined();
    });
  });

  describe('getRegionCode()', () => {
    it('returns the two letter abbreviation in the businessUnit string', () => {
      const businessUnit = 'SK - LAND MGMNT - SKEENA FIELD OFFICE';
      expect(service.getRegionCode(businessUnit)).toBe('SK');
    });

    it('returns undefined if no businessUnit is present', () => {
      expect(service.getRegionCode()).toBeUndefined();
    });
  });
});
