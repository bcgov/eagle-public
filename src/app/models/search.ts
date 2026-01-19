import { Params } from '@angular/router';

export class SearchResults {
  _schemaName: string;
  data: any;
  hostname: any;
  totalSearchCount: number

  constructor(search?: any, hostname?: any, totalSearchCount?: number) {
    this._schemaName = search && search._schemaName || 0;
    this.data = search && search.data || 0;
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

export class SearchTerms {
  keywords: string; // comma- or space-delimited list
  dateStart: string | null;
  dateEnd: string | null;
  dataset: string;
  currentPage: number;
  sortBy: string;
  sortDirection: number;

  constructor(obj?: any) {
    this.keywords = obj && obj.keywords || null;
    this.dateStart = obj && obj.dateStart || null;
    this.dateEnd = obj && obj.dateEnd || null;
    this.dataset = obj && obj.dataset || null;
    this.currentPage = obj && obj.currentPage || null;
    this.sortBy = obj && obj.sortBy || null;
    this.sortDirection = obj && obj.sortDirection || null;
  }

  getParams(): Params {
    const params: Params = {};

    if (this.keywords) {
      // tokenize by comma, space, etc and remove duplicate items
      // const keywords = _.uniq(this.keywords.match(/\b(\w+)/g));
      params['keywords'] = this.keywords;
    }
    if (this.dateStart) {
      params['datestart'] = this.dateStart;
    }
    if (this.dateEnd) {
      params['dateend'] = this.dateEnd;
    }
    if (this.currentPage) {
      params['currentPage'] = this.currentPage;
    }
    if (this.sortBy) {
      params['sortBy'] = this.sortBy;
    }
    if (this.sortDirection) {
      params['sortDirection'] = this.sortDirection;
    }

    return params;
  }
}
