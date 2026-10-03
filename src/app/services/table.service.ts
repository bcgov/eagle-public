import { Injectable, signal, WritableSignal, inject } from '@angular/core';
import { SearchParamObject, SearchService } from './search.service';

/**
 * Signal-based table data service.
 * Each table is identified by a unique tableId and has its own signal for data updates.
 * Loading state is managed through LoadingStateService (in SearchService).
 */
@Injectable({
  providedIn: 'root'
})
export class TableService {
  private tables = new Map<string, WritableSignal<any>>();
  // Latest request number per table, so a slower earlier response cannot overwrite a newer one.
  private latestRequest = new Map<string, number>();
  private searchService = inject(SearchService);

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
   * Fetch data for a table and update its signal.
   * Note: Loading state is managed by SearchService since it makes the actual API calls.
   */
  async fetchData(searchParamObject: SearchParamObject): Promise<void> {
    const tableId = searchParamObject.tableId;
    const tableSignal = this.getTableSignal(tableId);
    const request = (this.latestRequest.get(tableId) ?? 0) + 1;
    this.latestRequest.set(tableId, request);
    const isLatest = () => this.latestRequest.get(tableId) === request;

    try {
      const res = await this.searchService.fetchData(searchParamObject);
      if (!isLatest()) { return; }
      // Always trigger an update by creating a new object reference
      // This ensures subscribers are notified even if data is identical
      tableSignal.set({ ...res, _timestamp: Date.now() });
    } catch (error) {
      if (!isLatest()) { return; }
      // On error, still update signal to show empty state
      tableSignal.set({ data: [], totalSearchCount: 0, error: true, _timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Clear all tables
   */
  clearAll(): void {
    this.tables.clear();
  }
}
