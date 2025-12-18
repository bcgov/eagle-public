import { Injectable, signal, WritableSignal } from '@angular/core';
import { SearchParamObject, SearchService } from './search.service';

/**
 * Signal-based table data service.
 * Each table is identified by a unique tableId and has its own signal for data updates.
 */
@Injectable({
  providedIn: 'root'
})
export class TableService {
  private tables = new Map<string, WritableSignal<any>>();

  constructor(private searchService: SearchService) {}

  /**
   * Get or create a signal for a table
   */
  getTableSignal(tableId: string): WritableSignal<any> {
    if (!this.tables.has(tableId)) {
      this.tables.set(tableId, signal(null));
    }
    return this.tables.get(tableId)!;
  }

  /**
   * Fetch data for a table and update its signal
   */
  async fetchData(searchParamObject: SearchParamObject): Promise<void> {
    const tableSignal = this.getTableSignal(searchParamObject.tableId);
    const res = await this.searchService.fetchData(searchParamObject);
    tableSignal.set(res);
  }

  /**
   * Clear all tables
   */
  clearAll(): void {
    this.tables.clear();
  }
}
