import { SearchResults } from 'app/models/search';
import { Constants } from 'app/utils/constants';
import * as api from './api';
import { createStore, useStore } from 'app/state/store';
import { startLoading, stopLoading } from 'app/state/loading-state';
import { logger } from 'app/config/logging';

const pins = createStore<SearchResults>(new SearchResults());

export let fetchDataConfig = {
  currentPage: Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
  pageSize: Constants.tableDefaults.DEFAULT_PAGE_SIZE,
  sortBy: Constants.tableDefaults.DEFAULT_SORT_BY,
  projId: ''
};

export function setValue(value: SearchResults): void {
  pins.set(value);
}

export function getValue(): SearchResults {
  return pins.get();
}

export function usePins(): SearchResults {
  return useStore(pins);
}

export async function refreshData(): Promise<void> {
  await fetchData(
    fetchDataConfig.currentPage,
    fetchDataConfig.pageSize,
    fetchDataConfig.sortBy,
    fetchDataConfig.projId
  );
}

export async function fetchData(
  currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
  pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
  sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
  projId = ''
): Promise<void> {
  const loadingId = `pins-${projId || 'all'}-page-${currentPage}`;
  startLoading(loadingId, 'Loading pins');

  // Caching for later
  fetchDataConfig = { currentPage, pageSize, sortBy, projId };

  let res: any = null;
  try {
    res = await api.getProjectPins(projId, currentPage, pageSize, sortBy);
  } catch (error) {
    stopLoading(loadingId);
    logger.error(String(error), 'PINs Service');
  }

  const searchResults = new SearchResults();

  if (res && Array.isArray(res) && res[0]) {
    if (res[0].results) {
      searchResults.data = res[0].results;
    } else if (res[0].total_items === 0) {
      searchResults.data = [];
    } else {
      logger.error('Search results were empty.', 'PINs Service');
    }
    if (res[0].total_items !== undefined && res[0].total_items !== null) {
      searchResults.totalSearchCount = res[0].total_items;
    } else {
      logger.error('Total search results count was not returned.', 'PINs Service');
    }
  } else {
    logger.error('No data was returned from the server.', 'PINs Service');
  }
  stopLoading(loadingId);
  setValue(searchResults);
}

export function clearValue(): void {
  setValue(new SearchResults());
}
