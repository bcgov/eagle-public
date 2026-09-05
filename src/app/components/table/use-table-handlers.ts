import type { RefObject } from 'react';
import { track } from 'app/analytics/analytics';
import type { IPageSizePickerOption, ITableMessage, TableObject } from './table-object';

interface TableHandlerParams {
  data: TableObject;
  /** Row component name, reported to analytics as the kind of table this is. */
  tableType: string;
  totalPages: number;
  containerRef: RefObject<HTMLDivElement | null>;
  onMessage: (msg: ITableMessage) => void;
}

/** Sort and paging callbacks shared by the table frames, analytics included. */
export function useTableHandlers({
  data,
  tableType,
  totalPages,
  containerRef,
  onMessage,
}: TableHandlerParams) {
  function onSort(property: string): void {
    track('Table Column Sorted', {
      table_type: tableType,
      column: property,
      direction: data.sortBy === `+${property}` ? 'desc' : 'asc',
    });
    onMessage({ label: 'columnSort', data: property });
  }

  function onUpdatePageNumber(pageNum: number): void {
    track('Pagination Changed', {
      table_type: tableType,
      from_page: data.currentPage,
      to_page: pageNum,
      total_pages: totalPages,
    });
    // Paging from the bottom control otherwise leaves the reader at the foot of the new page.
    // Optional call: jsdom has no scrollIntoView.
    containerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    onMessage({ label: 'pageNum', data: pageNum });
  }

  function onUpdatePageSize(pageSize: IPageSizePickerOption): void {
    track('Page Size Changed', {
      table_type: tableType,
      from_size: data.pageSize,
      to_size: pageSize.value,
    });
    onMessage({ label: 'pageSize', data: pageSize });
  }

  return { onSort, onUpdatePageNumber, onUpdatePageSize };
}
