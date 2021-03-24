import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EventKeywords, EventObject, EventService } from './event.service';
import { SearchResults } from 'app/models/search';
import { Constants } from 'app/shared/utils/constants';
import { ApiService } from './api';

@Injectable({
  providedIn: 'root'
})
export class PinsService {
  private data: BehaviorSubject<SearchResults>;
  public fetchDataConfig: any;

  constructor(
    private api: ApiService,
    private eventService: EventService
  ) {
    this.data = new BehaviorSubject<SearchResults>(new SearchResults);

    this.fetchDataConfig = {
      currentPage: Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
      pageSize: Constants.tableDefaults.DEFAULT_PAGE_SIZE,
      sortBy: Constants.tableDefaults.DEFAULT_SORT_BY,
      projId: ''
    }
  }

  setValue(value): void {
    this.data.next(value);
  }

  getValue(): Observable<SearchResults> {
    return this.data.asObservable();
  }

  async refreshData() {
    await this.fetchData(
      this.fetchDataConfig.currentPage,
      this.fetchDataConfig.pageSize,
      this.fetchDataConfig.sortBy,
      this.fetchDataConfig.projId
    );
  }

  async fetchData(
    currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    projId: string = ''
  ) {

    // Caching for later
    this.fetchDataConfig = {
      currentPage: currentPage,
      pageSize: pageSize,
      sortBy: sortBy,
      projId: projId
    };

    let res = null;
    try {
      res = await this.api.getProjectPins(projId, currentPage, pageSize, sortBy).toPromise();
    } catch (error) {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          error,
          'PINs Service'
        )
      );
    }

    // tslint:disable-next-line: prefer-const
    let searchResults = new SearchResults();

    if (res && res[0]) {
      if (res[0].results) {
        searchResults.data = res[0].results;
      } else {
        this.eventService.setError(
          new EventObject(
            EventKeywords.ERROR,
            'Search results were empty.',
            'PINs Service'
          )
        );
      }
      if (res[0].total_items) {
        searchResults.totalSearchCount = res[0].total_items;
      } else {
        this.eventService.setError(
          new EventObject(
            EventKeywords.ERROR,
            'Total search results count was not returned.',
            'PINs Service'
          )
        );
      }
    } else {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          'No data was returned from the server.',
          'PINs Service'
        )
      );
    }
    this.setValue(searchResults);
  }
}
