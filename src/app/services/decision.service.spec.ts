import { async, TestBed } from '@angular/core/testing';
import { Decision } from 'app/models/decision';
import 'rxjs/add/observable/of';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/throw';
import { ApiService } from './api';
import { DecisionService } from './decision.service';
import { DocumentService } from './document.service';
import { Document } from 'app/models/document';

describe('DecisionService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: jasmine.createSpyObj('ApiService', [
            'getDecisionByAppId',
            'getDecision',
            'handleError'
          ])
        },
        {
          provide: DocumentService,
          useValue: jasmine.createSpyObj('DocumentService', [
            'getAllByDecisionId'
          ])
        },
        DecisionService
      ]
    });
  });

  it('should be created', () => {
    const service: DecisionService = TestBed.get(DecisionService);
    expect(service).toBeTruthy();
  });

  describe('getByApplicationId', () => {
    let service: DecisionService;
    let apiSpy;
    let documentServiceSpy;
    beforeEach(() => {
      service = TestBed.get(DecisionService);
      apiSpy = TestBed.get(ApiService);
      documentServiceSpy = TestBed.get(DocumentService);
    });

    describe('when forceReload is set to true', () => {
      describe('when no decision is returned by the Api', () => {
        it('returns a null Decision', async(() => {
          apiSpy.getDecisionByAppId.and.returnValue(
            Observable.of({ text: () => {} })
          );

          service
            .getByApplicationId('1', true)
            .subscribe(result => expect(result).toEqual(null as Decision));
        }));
      });

      describe('when one decision is returned by the Api', () => {
        it('returns one Decision', async(() => {
          apiSpy.getDecisionByAppId.and.returnValue(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '1' }]
            })
          );

          documentServiceSpy.getAllByDecisionId.and.callFake(
            (decisionId: String) => {
              expect(decisionId).toEqual('1');
              return Observable.of([new Document({ _id: '11' })]);
            }
          );

          service.getByApplicationId('1', true).subscribe(result =>
            expect(result).toEqual(
              new Decision({
                _id: '1',
                documents: [new Document({ _id: '11' })]
              })
            )
          );
        }));
      });

      describe('when multiple decisions are returned by the Api', () => {
        it('returns only the first Decision', async(() => {
          apiSpy.getDecisionByAppId.and.returnValue(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '2' }, { _id: '3' }, { _id: '4' }]
            })
          );

          documentServiceSpy.getAllByDecisionId.and.returnValues(
            Observable.of([new Document({ _id: '22' })]),
            Observable.throw(
              Error(
                // TODO handle this forced error better.  Self invoking fail() function?  Force res.text() to throw error instead?
                'Was not expecting DocumentService.getAllByDecisionId to be called more than once.'
              )
            )
          );

          service.getByApplicationId('1', true).subscribe(result => {
            expect(result).toEqual(
              new Decision({
                _id: '2',
                documents: [new Document({ _id: '22' })]
              })
            );
          });
        }));
      });
    });

    describe('when forceReload is set to false', () => {
      describe('when a decision is cached', () => {
        beforeEach(async(() => {
          documentServiceSpy.getAllByDecisionId.and.returnValues(
            Observable.of([new Document({ _id: '33' })]),
            Observable.throw(
              Error(
                'Was not expecting DocumentService.getAllByDecisionId to be called more than once.'
              )
            )
          );

          apiSpy.getDecisionByAppId.and.returnValues(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '3', _application: '31' }]
            }),
            Observable.throw(
              Error(
                'Was not expecting ApiService.getDecisionByAppId to be called more than once.'
              )
            )
          );

          // call once to set the cache
          service.getByApplicationId('3', true).subscribe();
        }));

        it('returns the cached decision', async(() => {
          // assert cached decision is returned
          service.getByApplicationId('31').subscribe(result => {
            expect(result).toEqual(
              new Decision({
                _id: '3',
                _application: '31',
                documents: [new Document({ _id: '33' })]
              })
            );
          });
        }));
      });

      describe('when no decision is cached', () => {
        it('calls the api to fetch a decision', async(() => {
          apiSpy.getDecisionByAppId.and.returnValue(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '4', _application: '41' }]
            })
          );

          documentServiceSpy.getAllByDecisionId.and.returnValues(
            Observable.of([new Document({ _id: '44' })]),
            Observable.throw(
              Error(
                'Was not expecting DocumentService.getAllByDecisionId to be called more than once.'
              )
            )
          );

          service.getByApplicationId('41').subscribe(result => {
            expect(result).toEqual(
              new Decision({
                _id: '4',
                _application: '41',
                documents: [new Document({ _id: '44' })]
              })
            );
          });
        }));
      });
    });

    describe('when an exception is thrown', () => {
      it('ApiService.handleError is called and the error is re-thrown', async(() => {
        apiSpy.getDecisionByAppId.and.returnValue(
          Observable.of({
            text: () => {
              throw Error('someError');
            }
          })
        );
        apiSpy.handleError.and.callFake(error => {
          expect(error).toEqual(Error('someError'));
          return Observable.throw(Error('someRethrownError'));
        });

        service.getByApplicationId('1').subscribe(
          () => {
            fail('An error was expected.');
          },
          err => {
            expect(err).toEqual(Error('someRethrownError'));
          }
        );
      }));
    });
  });

  describe('getById', () => {
    let service: DecisionService;
    let apiSpy;
    let documentServiceSpy;
    beforeEach(() => {
      service = TestBed.get(DecisionService);
      apiSpy = TestBed.get(ApiService);
      documentServiceSpy = TestBed.get(DocumentService);
    });

    describe('when forceReload is set to true', () => {
      describe('when no decision is returned by the Api', () => {
        it('returns a null Decision', async(() => {
          apiSpy.getDecision.and.returnValue(Observable.of({ text: () => {} }));

          service
            .getById('1', true)
            .subscribe(result => expect(result).toEqual(null as Decision));
        }));
      });

      describe('when one decision is returned by the Api', () => {
        it('returns one Decision', async(() => {
          apiSpy.getDecision.and.returnValue(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '1' }]
            })
          );

          documentServiceSpy.getAllByDecisionId.and.callFake(
            (decisionId: String) => {
              expect(decisionId).toEqual('1');
              return Observable.of([new Document({ _id: '11' })]);
            }
          );

          service.getById('1', true).subscribe(result =>
            expect(result).toEqual(
              new Decision({
                _id: '1',
                documents: [new Document({ _id: '11' })]
              })
            )
          );
        }));
      });

      describe('when multiple decisions are returned by the Api', () => {
        it('returns only the first Decision', async(() => {
          apiSpy.getDecision.and.returnValue(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '4' }, { _id: '5' }, { _id: '6' }]
            })
          );

          documentServiceSpy.getAllByDecisionId.and.returnValues(
            Observable.of([new Document({ _id: '44' })]),
            Observable.throw(
              Error(
                'Was not expecting DocumentService.getAllByDecisionId to be called more than once.'
              )
            )
          );

          service.getById('4', true).subscribe(result => {
            expect(result).toEqual(
              new Decision({
                _id: '4',
                documents: [new Document({ _id: '44' })]
              })
            );
          });
        }));
      });
    });

    describe('when forceReload is set to false', () => {
      describe('when a decision is cached', () => {
        beforeEach(async(() => {
          documentServiceSpy.getAllByDecisionId.and.returnValues(
            Observable.of([new Document({ _id: '55' })]),
            Observable.throw(
              new Error(
                'Was not expecting DocumentService.getAllByDecisionId to be called more than once.'
              )
            )
          );

          apiSpy.getDecision.and.returnValues(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '5', _application: '51' }]
            }),
            Observable.throw(
              new Error(
                'Was not expecting ApiService.getDecision to be called more than once.'
              )
            )
          );

          // call once to set the cache
          service.getById('5', true).subscribe();
        }));

        it('returns the cached decision', async(() => {
          // assert cached decision is returned
          service.getById('5').subscribe(result => {
            expect(result).toEqual(
              new Decision({
                _id: '5',
                _application: '51',
                documents: [new Document({ _id: '55' })]
              })
            );
          });
        }));
      });

      describe('when no decision is cached', () => {
        it('calls the api to fetch a decision', async(() => {
          apiSpy.getDecision.and.returnValue(
            Observable.of({
              text: () => 'notNull',
              json: () => [{ _id: '7', _application: '71' }]
            })
          );

          documentServiceSpy.getAllByDecisionId.and.returnValues(
            Observable.of([new Document({ _id: '77' })]),
            Observable.throw(
              Error(
                'Was not expecting DocumentService.getAllByDecisionId to be called more than once.'
              )
            )
          );

          service.getById('7').subscribe(result => {
            expect(result).toEqual(
              new Decision({
                _id: '7',
                _application: '71',
                documents: [new Document({ _id: '77' })]
              })
            );
          });
        }));
      });
    });

    describe('when an exception is thrown', () => {
      it('ApiService.handleError is called and the error is re-thrown', async(() => {
        apiSpy.getDecision.and.returnValue(
          Observable.of({
            text: () => {
              throw Error('someError');
            }
          })
        );
        apiSpy.handleError.and.callFake(error => {
          expect(error).toEqual(Error('someError'));
          return Observable.throw(Error('someRethrownError'));
        });

        service.getById('1').subscribe(
          () => {
            fail('An error was expected.');
          },
          err => {
            expect(err).toEqual(Error('someRethrownError'));
          }
        );
      }));
    });
  });
});
