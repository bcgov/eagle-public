import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SearchService } from 'app/services/search.service';

export const documentTableResolver: ResolveFn<Observable<object>> = (): Observable<object> => {
  const searchService = inject(SearchService);
  return searchService.getFullList('List');
};
