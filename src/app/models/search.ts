export class SearchResults {
  _schemaName: string;
  data: any;
  hostname: any;
  totalSearchCount: number;

  constructor(search?: any, hostname?: any, totalSearchCount?: number) {
    this._schemaName = (search && search._schemaName) || 0;
    this.data = (search && search.data) || 0;
    this.hostname = hostname || null;
    this.totalSearchCount = totalSearchCount || 0;
  }
}

export interface ISearchResults<T> {
  data: ISearchResult<T>;
}
// TODO: Flesh out these interfaces
export interface ISearchResult<T> {
  meta: any;
  searchResults: T[];
}
