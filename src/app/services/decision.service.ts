import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/of';

import { ApiService } from './api';
import { DocumentService } from './document.service';
import { Decision } from 'app/models/decision';

@Injectable()
export class DecisionService {
  private decision: Decision = null;

  constructor(
    private api: ApiService,
    private documentService: DocumentService
  ) { }

  // get decision for the specified application id
  getByApplicationId(appId: string, forceReload: boolean = false): Observable<Decision> {
    if (this.decision && this.decision._application === appId && !forceReload) {
      return Observable.of(this.decision);
    }

    // first get the decision data
    return this.api.getDecisionByAppId(appId)
      .map((res: any) => {
        const decisions = res.text() ? res.json() : [];
        // return the first (only) decision
        return decisions.length > 0 ? new Decision(decisions[0]) : null;
      })
      .mergeMap(decision => {
        if (!decision) { return Observable.of(null as Decision); }

        // now get the decision documents
        const promise = this.documentService.getAllByDecisionId(decision._id)
          .toPromise()
          .then(documents => decision.documents = documents);

        return Promise.resolve(promise).then(() => {
          this.decision = decision;
          return decision;
        });
      })
      .catch(this.api.handleError);
  }

  // get a specific decision by its id
  getById(decisionId, forceReload: boolean = false): Observable<Decision> {
    if (this.decision && this.decision._id === decisionId && !forceReload) {
      return Observable.of(this.decision);
    }

    // first get the decision data
    return this.api.getDecision(decisionId)
      .map((res: any) => {
        const decisions = res.text() ? res.json() : [];
        // return the first (only) decision
        return decisions.length > 0 ? new Decision(decisions[0]) : null;
      })
      .mergeMap(decision => {
        if (!decision) { return Observable.of(null as Decision); }

        // now get the decision documents
        const promise = this.documentService.getAllByDecisionId(decision._id)
          .toPromise()
          .then(documents => decision.documents = documents);

        return Promise.resolve(promise).then(() => {
          this.decision = decision;
          return decision;
        });
      })
      .catch(this.api.handleError);
  }
}
