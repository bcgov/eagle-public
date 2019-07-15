import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { SearchService } from 'app/services/search.service';
@Injectable()
export class DocumentTableResolver implements Resolve<Observable<object>> {
  constructor(
    private searchService: SearchService
  ) { }
  resolve(): Observable<object> {
   return this.searchService.getFullList('List');
  }
}
