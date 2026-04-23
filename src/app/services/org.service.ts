import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { Org } from 'app/models/organization';
import { LoadingStateService } from './loading-state.service';
import { withLoading } from 'app/shared/utils/rxjs-operators';

@Injectable({providedIn:'root'})
export class OrgService {
  private api = inject(ApiService);
  private loadingState = inject(LoadingStateService);

  private data: BehaviorSubject<Org[]>;
  constructor() {
    this.data = new BehaviorSubject<Org[]>([]);
  }

  getByCompanyType(type: string): Observable<Org[]> {
    const loadingId = `org-${type}`;
    return this.api.getOrgsByCompanyType(type)
      .pipe(
        withLoading(this.loadingState, loadingId, `Loading ${type} organizations`),
        map((res: any) => res ? (res as any[]).map(org => new Org(org)) : []),
        catchError(error => this.api.handleError(error))
      );
  }

  setValue(value: Org[] | null): void {
    this.data.next(value || []);
  }

  getValue(): Observable<Org[]> {
    return this.data.asObservable();
  }

  clearValue(): void {
    this.setValue(null);
  }

  async fetchProponent() {
    // Only fetch if data hasn't been loaded yet
    if (this.data.value && this.data.value.length > 0) {
      return;
    }
    
    const loadingId = 'org-proponent';
    this.loadingState.startLoading(loadingId, 'Loading proponent organizations');
    
    try {
      const res = await this.api.getOrgsByCompanyType('Proponent/Certificate Holder').toPromise();
      this.setValue(res || []);
      this.loadingState.stopLoading(loadingId);
    } catch (error) {
      this.loadingState.stopLoading(loadingId);
      throw error;
    }
  }
}
