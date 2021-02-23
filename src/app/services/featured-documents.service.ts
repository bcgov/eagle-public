import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EventKeywords, EventObject, EventService } from './event.service';
import { SearchResults } from 'app/models/search';
import { Constants } from 'app/shared/utils/constants';
import { SearchService } from './search.service';

@Injectable({
  providedIn: 'root'
})
export class FeaturedDocumentsService {
  private data: BehaviorSubject<SearchResults>;
  private fetchDataConfig: any;

  constructor(
    private searchService: SearchService,
    private eventService: EventService
  ) {
    this.data = new BehaviorSubject<SearchResults>(new SearchResults);

    this.fetchDataConfig = {
      keywords: Constants.tableDefaults.DEFAULT_KEYWORDS,
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
      this.fetchDataConfig.keywords,
      this.fetchDataConfig.currentPage,
      this.fetchDataConfig.pageSize,
      this.fetchDataConfig.sortBy,
      this.fetchDataConfig.projId
    );
  }

  async fetchData(
    keywords: string = Constants.tableDefaults.DEFAULT_KEYWORDS,
    currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    projId: string = ''
  ) {

    // Caching for later
    this.fetchDataConfig = {
      keywords: keywords,
      currentPage: currentPage,
      pageSize: pageSize,
      sortBy: sortBy,
      projId: projId
    };

    let res = null;
    try {
      res = await this.searchService.getSearchResults(
        this.fetchDataConfig.keywords,
        'Document',
        [{ 'name': 'project', 'value': projId }],
        this.fetchDataConfig.currentPage,
        this.fetchDataConfig.pageSize,
        this.fetchDataConfig.sortBy,
        { documentSource: 'PROJECT', isFeatured: 'true' },
        true
      ).toPromise();
    } catch (error) {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          error,
          'Featured Docuements Service'
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
            'Featured Docuements Service'
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
            'Featured Docuements Service'
          )
        );
      }
    } else {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          'No data was returned from the server.',
          'Featured Docuements Service'
        )
      );
    }
    this.setValue(searchResults);
  }
}
