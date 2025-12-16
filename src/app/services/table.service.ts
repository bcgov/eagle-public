import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SearchParamObject, SearchService } from './search.service';

@Injectable({
  providedIn: 'root'
})

export class TableService {
  public data: Record<string, any>;

  constructor(
    private searchService: SearchService,
  ) {
    this.data = {};
  }

  initTableData(tableId: string): void {
    this.data[tableId] = {
      behaviorSubject: new BehaviorSubject({ data: 0 }),
      cachedConfig: new SearchParamObject()
    };
  }

  setValue(tableId: string, value: any): void {
    this.data[tableId].behaviorSubject.next(value);
  }

  getValue(tableId: string): Observable<Object> {
    return this.data[tableId].behaviorSubject.asObservable();
  }

  // Encapsulated methods for cache access
  getCache(tableId: string): SearchParamObject {
    return this.data[tableId]?.cachedConfig;
  }

  updateCache(tableId: string, updates: Partial<SearchParamObject>): void {
    if (this.data[tableId]?.cachedConfig) {
      Object.assign(this.data[tableId].cachedConfig, updates);
    }
  }

  async refreshData(tableId: string): Promise<void> {
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

  async fetchData(searchParamObject: SearchParamObject): Promise<void> {
    const res = await this.searchService.fetchData(searchParamObject);
    this.data[searchParamObject.tableId].cachedConfig = searchParamObject;
    this.setValue(searchParamObject.tableId, res);
  }

  private checkIfTableDataExists(tableId: string): boolean {
    return Object.keys(this.data).includes(tableId);
  }
}
