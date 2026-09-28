import { Constants } from 'app/utils/constants';

export interface ITableOptions {
  /** Adds the checkbox column and the bulk-download selection controls. */
  selectable?: boolean;
}

export interface IRowObject {
  rowData?: any;
}

export interface TableObject {
  options: ITableOptions;
  items: IRowObject[];
  currentPage: number;
  pageSize: number;
  sortBy: string;
  totalListItems: number;
  tableId: string;
}

// The selection store is keyed by tableId, so a table without a stable one loses its selection
// on every render.
export function tableObject(
  params: Partial<TableObject> & Pick<TableObject, 'tableId'>,
): TableObject {
  return {
    options: params.options ?? {},
    items: params.items ?? [],
    currentPage: params.currentPage ?? Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    pageSize: params.pageSize ?? Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    sortBy: params.sortBy ?? Constants.tableDefaults.DEFAULT_SORT_BY,
    totalListItems: params.totalListItems ?? 0,
    tableId: params.tableId,
  };
}

/** Page numbers around the current page, with ellipses once the list grows past 7 pages. */
export function pageNumbers(total: number, current: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  let startPage = Math.max(2, current - 2);
  let endPage = Math.min(total - 1, current + 2);

  if (current <= 4) {
    endPage = Math.min(5, total - 1);
  }

  if (current >= total - 3) {
    startPage = Math.max(2, total - 4);
  }

  if (startPage > 2) {
    pages.push('ellipsis');
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (endPage < total - 1) {
    pages.push('ellipsis');
  }

  if (total > 1) {
    pages.push(total);
  }

  return pages;
}
