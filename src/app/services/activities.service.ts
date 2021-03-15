import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EventKeywords, EventObject, EventService } from './event.service';
import { SearchResults } from 'app/models/search';
import { Constants } from 'app/shared/utils/constants';
import { SearchService } from './search.service';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesService {
  private data: BehaviorSubject<SearchResults>;
  private fetchDataConfig: any;

  constructor(
    private searchService: SearchService,
    private eventService: EventService
  ) {
    this.data = new BehaviorSubject<SearchResults>(new SearchResults);

    this.fetchDataConfig = {
      keywords: Constants.tableDefaults.DEFAULT_KEYWORDS,
      fields: [],
      currentPage: Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
      pageSize: Constants.tableDefaults.DEFAULT_PAGE_SIZE,
      sortBy: Constants.tableDefaults.DEFAULT_SORT_BY,
      queryModifier: {},
      populate: true
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
      this.fetchDataConfig.keywords,
      this.fetchDataConfig.fields,
      this.fetchDataConfig.currentPage,
      this.fetchDataConfig.pageSize,
      this.fetchDataConfig.sortBy,
      this.fetchDataConfig.queryModifier,
      this.fetchDataConfig.populate
    );
  }

  async fetchData(
    keywords: string = Constants.tableDefaults.DEFAULT_KEYWORDS,
    fields = [],
    currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    queryModifier = {},
    populate: boolean = true
  ) {

    // Caching for later
    this.fetchDataConfig = {
      keywords: keywords,
      fields: fields,
      currentPage: currentPage,
      pageSize: pageSize,
      sortBy: sortBy,
      queryModifier: queryModifier,
      populate: populate
    };

    let res = null;
    try {
      res = await this.searchService.getSearchResults(
        this.fetchDataConfig.keywords,
        'RecentActivity',
        this.fetchDataConfig.fields,
        this.fetchDataConfig.currentPage,
        this.fetchDataConfig.pageSize,
        this.fetchDataConfig.sortBy,
        this.fetchDataConfig.queryModifier,
        this.fetchDataConfig.populate
      ).toPromise();
    } catch (error) {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          error,
          'Activities Service'
        )
      );
    }

    // tslint:disable-next-line: prefer-const
    let searchResults = new SearchResults();

    if (res && res[0] && res[0].data) {
      if (res[0].data.searchResults) {
        searchResults.data = res[0].data.searchResults;
      } else {
        this.eventService.setError(
          new EventObject(
            EventKeywords.ERROR,
            'Search results were empty.',
            'Activities Service'
          )
        );
      }
      if (res[0].data.meta[0] && res[0].data.meta[0].searchResultsTotal) {
        searchResults.totalSearchCount = res[0].data.meta[0].searchResultsTotal;
      } else if (res[0].data.meta.lenght === 0) {
        searchResults.totalSearchCount = 0
      } else {
        this.eventService.setError(
          new EventObject(
            EventKeywords.ERROR,
            'Total search results count was not returned.',
            'Activities Service'
          )
        );
      }
    } else {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          'No data was returned from the server.',
          'Activities Service'
        )
      );
    }
    console.log(searchResults);

    this.setValue(searchResults);
  }
}
