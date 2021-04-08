import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { ApiService } from './api';
import { Org } from 'app/models/organization';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class OrgService {
  private data: BehaviorSubject<Org[]>;
  constructor(private api: ApiService) {
    this.data = new BehaviorSubject<Org[]>([]);
  }

  getByCompanyType(type: string): Observable<Org[]> {
    return this.api.getOrgsByCompanyType(type)
      .map((res: any) => {
        if (res) {
          const orgs = res;
          orgs.forEach((org, index) => {
            orgs[index] = new Org(org);
          });
          return orgs;
        }
      })
      .catch(this.api.handleError);
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
