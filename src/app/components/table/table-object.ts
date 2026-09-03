import type { ComponentType } from 'react';
import { Constants } from 'app/utils/constants';

/** A single page size option. */
export interface IPageSizePickerOption {
  displayText?: string;
  value: number;
}

export interface ITableOptions {
  showHeader?: boolean;
  showPagination?: boolean;
  showPageSizePicker?: boolean;
  showPageCountDisplay?: boolean;
  showAllPicker?: boolean;
  disableRowHighlight?: boolean;
  showTopControls?: boolean;
  rowSpacing?: number;
  /** Adds the checkbox column and the bulk-download selection controls. */
  selectable?: boolean;
}

export const DEFAULT_TABLE_OPTIONS: ITableOptions = {
  showHeader: true,
  showPagination: true,
  showPageSizePicker: true,
  showPageCountDisplay: true,
  disableRowHighlight: false,
  showTopControls: true,
  rowSpacing: 0,
};

/** Header cell definition. `value` is emitted on sort; `nosort` disables sorting for the column. */
export interface IColumnObject {
  name?: string;
  value?: string;
  width?: string;
  nosort?: boolean;
}

export interface IRowObject {
  rowData?: any;
  /** Overrides the table-wide row component for this row only. */
  component?: TableRowComponent;
}

/** Generic parent/child event, kept from the Angular engine so consumers port unchanged. */
export interface ITableMessage {
  label: 'pageNum' | 'pageSize' | 'columnSort' | 'selectAllMatching';
  data?: any;
}

export interface TableRowProps {
  rowData: any;
  tableData: TableObject;
  columns: IColumnObject[];
  onMessage: (msg: ITableMessage) => void;
}

export type TableRowComponent = ComponentType<TableRowProps>;

export interface TableObject {
  options: ITableOptions;
  component: TableRowComponent | null;
  columns: IColumnObject[];
  items: IRowObject[];
  dataset: string;
  currentPage: number;
  pageSizeOptions: IPageSizePickerOption[];
  pageSize: number;
  sortBy: string;
  totalListItems: number;
  tableId: string;
  /** Extra data handed to every row (lists, per-table styling, ...). */
  data?: any;
}

// The selection store is keyed by tableId, so a table without a stable one loses its selection
// on every render.
export function tableObject(
  params: Partial<TableObject> & Pick<TableObject, 'tableId'>,
): TableObject {
  return {
    options: params.options ?? { ...DEFAULT_TABLE_OPTIONS },
    component: params.component ?? null,
    columns: params.columns ?? [],
    items: params.items ?? [],
    dataset: params.dataset ?? Constants.tableDefaults.DEFAULT_DATASET,
    currentPage: params.currentPage ?? Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    pageSizeOptions: params.pageSizeOptions ?? [
      ...Constants.tableDefaults.DEFAULT_PAGE_SIZE_OPTIONS,
    ],
    pageSize: params.pageSize ?? Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    sortBy: params.sortBy ?? Constants.tableDefaults.DEFAULT_SORT_BY,
    totalListItems: params.totalListItems ?? 0,
    tableId: params.tableId,
    data: params.data ?? null,
  };
}

/**
 * Adds or removes the "Show All" page size option. Only offered while the result set is small
 * enough that one page of it is not a denial of service on the browser.
 */
export function withAllPicker(
  options: IPageSizePickerOption[],
  totalListItems: number,
): IPageSizePickerOption[] {
  const base = options.filter((option) => option.displayText !== 'Show All');
  if (totalListItems > 0 && totalListItems <= Constants.tableDefaults.MAX_SHOW_ALL_ITEMS) {
    return [...base, { displayText: 'Show All', value: totalListItems }];
  }
  return base;
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

/**
 * The document table header bar's quiet default line. Separate from `pageCountMessage`: that one
 * counts "results" for every table, this one names the documents the bar is about to download.
 */
export function documentCountMessage(
  totalItems: number,
  currentPageNum: number,
  currentPageSize: number,
): string {
  if (totalItems <= 0) return 'No documents';
  const high = Math.min(totalItems, currentPageNum * currentPageSize);
  const noun = totalItems === 1 ? 'document' : 'documents';
  if (high >= totalItems) return `${totalItems.toLocaleString()} ${noun}`;
  return `Showing ${high.toLocaleString()} of ${totalItems.toLocaleString()} ${noun}`;
}

export function pageCountMessage(
  totalItems: number,
  currentPageNum: number,
  currentPageSize: number,
): string {
  const pageCount = Math.max(1, Math.ceil(totalItems / currentPageSize));

  if (totalItems <= 0) {
    return '';
  }

  if (currentPageNum > pageCount) {
    // Rare edge-case: user manually incremented page param beyond valid range
    return 'Unable to display results, please clear and re-try';
  }

  const high = Math.min(totalItems, currentPageNum * currentPageSize);
  return `Showing ${high} of ${totalItems} results`;
}
