import * as api from './api';
import { SearchResults } from 'app/models/search';
import { News } from 'app/models/news';
import { Constants } from 'app/utils/constants';
import { startLoading, stopLoading } from 'app/state/loading-state';
import { logger } from 'app/config/logging';

export async function getFullList(schema: string): Promise<any> {
  return api.getFullDataSet(schema);
}

export async function getSearchResults(
  keys: string,
  dataset: string,
  fields: any[],
  pageNum = 1,
  pageSize = 10,
  sortBy: string | null = null,
  queryModifier: Record<string, string> = {},
  populate = false,
  secondarySort: string | null = null,
  filter: Record<string, string> = {},
  projectLegislation = '',
  fuzzy = false,
): Promise<any[] | null> {
  try {
    const res = await api.searchKeywords(
      keys,
      dataset,
      fields,
      pageNum,
      pageSize,
      projectLegislation,
      sortBy,
      queryModifier,
      populate,
      secondarySort,
      filter,
      fuzzy,
    );
    return res.map((item: any) => new SearchResults({ type: item._schemaName, data: item }));
  } catch {
    // if call fails, return null results
    return null;
  }
}

export async function getTopNewsItems(): Promise<News[]> {
  startLoading('home', 'Loading recent activities');
  try {
    const res = await api.getTopNewsItems();
    return Array.isArray(res) ? res.map((item) => new News(item)) : [];
  } catch (error) {
    logger.error('Error fetching top news items', 'search', error);
    return [];
  } finally {
    stopLoading('home');
  }
}

export async function fetchData(searchParamObject: SearchParamObject): Promise<SearchResults> {
  const loadingId = `table-${searchParamObject.tableId}`;
  logger.debug(`Starting loading for ${loadingId}`, 'search');
  startLoading(loadingId, `Loading ${searchParamObject.dataset} data`);
  let res: any[] | null = null;

  logger.debug('search.fetchData called', 'search', searchParamObject);

  // Remove null/undefined filters
  for (const filter in searchParamObject.filters) {
    if (
      searchParamObject.filters[filter] === null ||
      searchParamObject.filters[filter] === undefined
    ) {
      delete searchParamObject.filters[filter];
    }
  }

  try {
    res = await getSearchResults(
      searchParamObject.keywords,
      searchParamObject.dataset,
      searchParamObject.fields,
      searchParamObject.currentPage,
      searchParamObject.pageSize,
      searchParamObject.sortBy,
      searchParamObject.queryModifiers,
      searchParamObject.populate,
      searchParamObject.secondarySort,
      searchParamObject.filters,
      searchParamObject.projectLegislation,
      searchParamObject.fuzzy,
    );
  } catch (error) {
    logger.error(`Error in fetchData for ${loadingId}`, 'search', error);
    stopLoading(loadingId);
    // Return empty results on error
    return new SearchResults();
  }

  const searchResults = new SearchResults();

  if (res && res[0] && res[0].data) {
    if (res[0].data.searchResults) {
      searchResults.data = res[0].data.searchResults;
    } else {
      logger.error('Search results were empty.', searchParamObject.dataset + ' Service');
    }
    if (
      res[0].data.meta &&
      res[0].data.meta[0] &&
      res[0].data.meta[0].searchResultsTotal !== undefined &&
      res[0].data.meta[0].searchResultsTotal !== null
    ) {
      searchResults.totalSearchCount = res[0].data.meta[0].searchResultsTotal;
    } else if (res[0].data.meta && res[0].data.meta.length === 0) {
      searchResults.totalSearchCount = 0;
    } else {
      logger.error(
        'Total search results count was not returned.',
        searchParamObject.dataset + ' Service',
      );
    }
  } else {
    logger.error('No data was returned from the server.', searchParamObject.dataset + ' Service');
  }
  stopLoading(loadingId);
  return searchResults;
}

export class SearchParamObject {
  constructor(
    public tableId = '',
    public keywords: string = Constants.tableDefaults.DEFAULT_KEYWORDS,
    public dataset = '',
    public fields: any[] = [],
    public currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    public pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    public sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    public queryModifiers: Record<string, string> = {},
    public populate = false,
    public secondarySort = '',
    public filters: Record<string, string> = {},
    public projectLegislation = '',
    public fuzzy = false,
  ) {}
}
