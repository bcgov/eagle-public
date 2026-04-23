import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

import { ApiService } from './api';
import { DocumentService } from './document.service';
import { Decision } from 'app/models/decision';
import { LoadingStateService } from './loading-state.service';
import { withLoading } from 'app/shared/utils/rxjs-operators';

@Injectable({providedIn:'root'})
export class DecisionService {
  private api = inject(ApiService);
  private documentService = inject(DocumentService);
  private loadingState = inject(LoadingStateService);

  private decision: Decision | null = null;

  // get decision for the specified application id
  getByApplicationId(appId: string, forceReload = false): Observable<Decision> {
    if (this.decision && this.decision._application === appId && !forceReload) {
      return of(this.decision);
    }
    return this.fetchAndHydrate(this.api.getDecisionByAppId(appId), `decision-app-${appId}`);
  }

  // get a specific decision by its id
  getById(decisionId: string, forceReload = false): Observable<Decision> {
    if (this.decision && this.decision._id === decisionId && !forceReload) {
      return of(this.decision);
    }
    return this.fetchAndHydrate(this.api.getDecision(decisionId), `decision-${decisionId}`);
  }

  private fetchAndHydrate(source$: Observable<any>, loadingId: string): Observable<Decision> {
    return source$.pipe(
      withLoading(this.loadingState, loadingId, 'Loading decision'),
      map((res: any) => {
        const decisions = Array.isArray(res) ? res : [];
        return decisions.length > 0 ? new Decision(decisions[0]) : null;
      }),
      switchMap((decision: Decision | null) => {
        if (!decision) return of(null as unknown as Decision);
        return this.documentService.getAllByDecisionId(decision._id).pipe(
          map(documents => {
            decision.documents = documents || [];
            this.decision = decision;
            return decision;
          })
        );
      }),
      catchError(error => this.api.handleError(error))
    );
  }
}
