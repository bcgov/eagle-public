import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { ApiService } from './api';
import { Org } from 'app/models/organization';

@Injectable()
export class OrgService {

  constructor(private api: ApiService) { }

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
}
