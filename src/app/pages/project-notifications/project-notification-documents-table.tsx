import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listsQueryOptions } from 'app/config/config';
import { useResponsive } from 'app/state/responsive';
import { TableTemplate } from 'app/components/table/table-template';
import {
  tableObject,
  type IColumnObject,
  type ITableMessage,
} from 'app/components/table/table-object';
import { toggleSortDirection } from 'app/components/table/table-params';
import { useTable } from 'app/components/table/use-table';
import { ProjectNotificationDocumentsTableRow } from './project-notification-documents-table-rows';

interface ProjectNotificationDocumentsTableProps {
  /** The notification's `_id`: both the table's cache key and the documents' project filter. */
  tableId: string;
  header: string;
  backgroundColor?: string;
  rowBackgroundColor?: string;
}

const MOBILE_COLUMNS: IColumnObject[] = [
  { name: 'Name', value: 'displayName', width: 'col-6' },
  { name: 'Date', value: 'datePosted', width: 'col-3' },
  { name: 'Author', value: 'documentAuthor', width: 'col-3' },
];

const DESKTOP_COLUMNS: IColumnObject[] = [
  { name: 'Document Name', value: 'displayName', width: 'col-6' },
  { name: 'Date', value: 'datePosted', width: 'col-3' },
  { name: 'Document Author', value: 'documentAuthor', width: 'col-3' },
];

/** Backend inverts the sort convention: `+` is descending there, `-` is ascending. */
function invertSortForBackend(sortBy: string): string {
  return sortBy.startsWith('+') ? `-${sortBy.substring(1)}` : `+${sortBy.substring(1)}`;
}

export function ProjectNotificationDocumentsTable({
  tableId,
  header,
  backgroundColor = 'transparent',
  rowBackgroundColor = '#F7F8FA',
}: ProjectNotificationDocumentsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('-datePosted');
  const { isDesktop } = useResponsive();
  const { data: lists = [] } = useQuery(listsQueryOptions());

  const result = useTable(tableId, {
    dataset: 'Document',
    fields: [{ name: 'project', value: tableId }],
    currentPage,
    pageSize: 5,
    sortBy: invertSortForBackend(sortBy),
    queryModifiers: { documentSource: 'PROJECT-NOTIFICATION' },
    populate: true,
  });

  const data = {
    ...tableObject({
      tableId,
      component: ProjectNotificationDocumentsTableRow,
      columns: isDesktop ? DESKTOP_COLUMNS : MOBILE_COLUMNS,
      currentPage,
      pageSize: 5,
      sortBy,
      items: result.data.map((record) => ({ rowData: record })),
      totalListItems: result.totalListItems,
      data: { rowBackgroundColor, lists },
    }),
    options: {
      showHeader: true,
      showPageSizePicker: false,
      showPageCountDisplay: false,
      showAllPicker: false,
      showPagination: true,
      showTopControls: false,
      disableRowHighlight: false,
    },
  };

  function onMessage(msg: ITableMessage): void {
    switch (msg.label) {
      case 'columnSort':
        setSortBy(toggleSortDirection(sortBy, msg.data, '-'));
        setCurrentPage(1);
        break;
      case 'pageNum':
        setCurrentPage(msg.data);
        break;
    }
  }

  return (
    <div
      className="pn-documents-table"
      style={{ background: backgroundColor, ['--row-bg-color' as string]: rowBackgroundColor }}
    >
      {header && (
        <div className="row mb-3 mt-2">
          <div className="col-12">
            <h4>{header}</h4>
          </div>
        </div>
      )}
      <TableTemplate data={data} loading={result.loading} onMessage={onMessage} />
    </div>
  );
}
