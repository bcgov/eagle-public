import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { Constants } from 'app/shared/utils/constants';
import { PinsService } from 'app/services/pins.service';

@Injectable()
export class PinsResolverService implements Resolve<void> {
  constructor(
    private pinsService: PinsService
  ) { }

  async resolve(route: ActivatedRouteSnapshot) {
    const params = route.queryParamMap['params'];
    const projectId = route.parent.paramMap.get('projId');
    const pageNum = params.currentPagePins ? params.currentPagePins : Constants.tableDefaults.DEFAULT_CURRENT_PAGE;
    const pageSize = params.pageSizePins ? params.pageSizePins : Constants.tableDefaults.DEFAULT_PAGE_SIZE;
    const sortBy = params.sortByPins ? params.sortByPins : '+name';
    await this.pinsService.fetchData(pageNum, pageSize, sortBy, projectId);
  }
}
