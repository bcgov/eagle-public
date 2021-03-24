import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SearchResults } from 'app/models/search';
import { SearchParamObject, SearchService } from './search.service';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesService {
  private data: BehaviorSubject<SearchResults>;
  public fetchDataConfig: any;

  constructor(
    private searchService: SearchService,
  ) {
    this.data = new BehaviorSubject<SearchResults>(new SearchResults);

    this.fetchDataConfig = new SearchParamObject();
    this.fetchDataConfig.dataset = 'RecentActivity';
  }

  setValue(value): void {
    this.data.next(value);
  }

  getValue(): Observable<SearchResults> {
    return this.data.asObservable();
  }

  async refreshData() {
    await this.fetchData(this.fetchDataConfig);
  }

  async fetchData(searchParamObject: SearchParamObject) {
    // Caching for later
    this.fetchDataConfig = searchParamObject;
    const res = await this.searchService.fetchData(searchParamObject);
    this.setValue(res);
  }
}
