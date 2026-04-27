import { Injectable, signal, WritableSignal, inject } from '@angular/core';
import { SearchParamObject, SearchService } from './search.service';
import { LoadingStateService } from './loading-state.service';

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
  private searchService = inject(SearchService);
  private loadingState = inject(LoadingStateService);

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
   */
  async fetchData(searchParamObject: SearchParamObject): Promise<void> {
    const tableSignal = this.getTableSignal(searchParamObject.tableId);
    
    try {
      const res = await this.searchService.fetchData(searchParamObject);
      tableSignal.set({ ...res, _timestamp: Date.now() });
    } catch (error) {
      // On error, still update signal to show empty state
      tableSignal.set({ data: [], totalSearchCount: 0, error: true, _timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Clear a single table's signal and start loading immediately to prevent
   * the stale-data flash where null signal + loading=false briefly shows "no results".
   */
  clearTable(tableId: string): void {
    this.loadingState.startLoading(`table-${tableId}`);
    this.tables.get(tableId)?.set(null);
  }

  /**
   * Clear all tables
   */
  clearAll(): void {
    this.tables.clear();
  }
}
