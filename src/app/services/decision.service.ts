import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, mergeMap } from 'rxjs/operators';

import { ApiService } from './api';
import { DocumentService } from './document.service';
import { Decision } from 'app/models/decision';
import { LoadingStateService } from './loading-state.service';

@Injectable({providedIn:'root'})
export class DecisionService {
  private decision: Decision | null = null;

  constructor(
    private api: ApiService,
    private documentService: DocumentService,
    private loadingState: LoadingStateService
  ) { }

  // get decision for the specified application id
  getByApplicationId(appId: string, forceReload: boolean = false): Observable<Decision> {
    if (this.decision && this.decision._application === appId && !forceReload) {
      return of(this.decision);
    }

    const loadingId = `decision-app-${appId}`;
    this.loadingState.startLoading(loadingId, 'Loading decision');
    // first get the decision data
    return this.api.getDecisionByAppId(appId)
      .pipe(
        map((res: any) => {
          const decisions = res.text() ? res.json() : [];
          // return the first (only) decision
          return decisions.length > 0 ? new Decision(decisions[0]) : null;
        }),
        mergeMap((decision: Decision | null) => {
          if (!decision) { 
            this.loadingState.stopLoading(loadingId);
            return of(null as unknown as Decision); 
          }

          // now get the decision documents
          const promise = this.documentService.getAllByDecisionId(decision._id)
            .toPromise()
            .then(documents => decision.documents = documents || []);

          return Promise.resolve(promise).then(() => {
            this.decision = decision;
            this.loadingState.stopLoading(loadingId);
            return decision;
          });
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // get a specific decision by its id
  getById(decisionId: string, forceReload: boolean = false): Observable<Decision> {
    if (this.decision && this.decision._id === decisionId && !forceReload) {
      return of(this.decision);
    }

    const loadingId = `decision-${decisionId}`;
    this.loadingState.startLoading(loadingId, 'Loading decision');
    // first get the decision data
    return this.api.getDecision(decisionId)
      .pipe(
        map((res: any) => {
          const decisions = res.text() ? res.json() : [];
          // return the first (only) decision
          return decisions.length > 0 ? new Decision(decisions[0]) : null;
        }),
        mergeMap((decision: Decision | null) => {
          if (!decision) { 
            this.loadingState.stopLoading(loadingId);
            return of(null as unknown as Decision); 
          }

          // now get the decision documents
          const promise = this.documentService.getAllByDecisionId(decision._id)
            .toPromise()
            .then(documents => decision.documents = documents || []);

          return Promise.resolve(promise).then(() => {
            this.decision = decision;
            this.loadingState.stopLoading(loadingId);
            return decision;
          });
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }
}
