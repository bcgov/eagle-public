import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SearchService } from 'app/services/search.service';

export const projectNotificationResolver: ResolveFn<Observable<object>> = (route): Observable<object> => {
  const searchService = inject(SearchService);
  
  return searchService.getSearchResults(
    '',
    'ProjectNotification',
    [],
    1,
    10000,
    '-_id',
    {_id: route.params['projId']}
  );
};
