import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SearchParamObject, SearchService } from './search.service';

@Injectable({
  providedIn: 'root'
})

// TODO: Migrate all services to use this universal table service.
// Data allows for multiple pieces of data to be cached.
// This means id and iteration version is required.
export class TableService {
  public data: Record<string, any>;

  constructor(
    private searchService: SearchService,
  ) {
    this.data = {};
  }

  // You need to init the table before fetchData.
  // This allows our component to subscribe before data is provided.
  initTableData(tableId: string) {
    this.data[tableId] = {
      behaviorSubject: new BehaviorSubject({ data: 0 }),
      cachedConfig: new SearchParamObject()
    }
  }

  setValue(tableId: string, value: any): void {
    this.data[tableId].behaviorSubject.next(value);
  }

  getValue(tableId: string): Observable<Object> {
    return this.data[tableId].behaviorSubject.asObservable();
  }

  async refreshData(tableId: string) {
    await this.fetchData(this.data[tableId].cachedConfig);
  }

  clearAll(): void {
    this.data = {};
  }

  clearTable(tableId: string): void {
    if (this.checkIfTableDataExists(tableId)) {
      this.setValue(tableId, { data: 0 });
    }
  }

  async fetchData(searchParamObject: SearchParamObject) {
    const res = await this.searchService.fetchData(searchParamObject);
    this.data[searchParamObject.tableId].cachedConfig = searchParamObject;
    this.setValue(searchParamObject.tableId, res);
  }

  private checkIfTableDataExists(tableId: string) {
    return Object.keys(this.data).includes(tableId)
  }
}
