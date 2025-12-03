import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { Org } from 'app/models/organization';

@Injectable()
export class OrgService {
  private data: BehaviorSubject<Org[]>;
  constructor(private api: ApiService) {
    this.data = new BehaviorSubject<Org[]>([]);
  }

  getByCompanyType(type: string): Observable<Org[]> {
    return this.api.getOrgsByCompanyType(type)
      .pipe(
        map((res: any) => {
          if (res) {
            const orgs = res;
            orgs.forEach((org, index) => {
              orgs[index] = new Org(org);
            });
            return orgs;
          }
        }),
        catchError(this.api.handleError)
      );
  }

  setValue(value): void {
    this.data.next(value);
  }

  getValue(): Observable<Org[]> {
    return this.data.asObservable();
  }

  clearValue(): void {
    this.setValue(null);
  }

  async fetchProponent() {
    const res = await this.getByCompanyType('Proponent/Certificate Holder').toPromise();
    this.setValue(res);
  }
}
