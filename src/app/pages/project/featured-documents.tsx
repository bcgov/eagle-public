import { DOWNLOAD_COLUMN } from 'app/components/table/document-row';
import { TableTemplate } from 'app/components/table/table-template';
import { tableObject, type IColumnObject } from 'app/components/table/table-object';
import { useTable } from 'app/components/table/use-table';
import { DocumentTableRow } from './document-table-rows';
import { useProjectContext } from './project-context';

const COLUMNS: IColumnObject[] = [
  { name: '★', value: 'isFeatured', width: 'col-1', nosort: true },
  { name: 'Name', value: 'displayName', width: 'col-3', nosort: true },
  { name: 'Date', value: 'datePosted', width: 'col-2', nosort: true },
  { name: 'Type', value: 'type', width: 'col-2', nosort: true },
  { name: 'Milestone', value: 'milestone', width: 'col-2', nosort: true },
  { name: 'Phase', value: 'projectPhase', width: 'col-2', nosort: true },
  DOWNLOAD_COLUMN
];

const PAGE_SIZE = 5;

/** The project's starred documents: a fixed top five, no paging or sorting. */
export function FeaturedDocuments() {
  const { projId, lists } = useProjectContext();

  const result = useTable('featuredDocuments', {
    dataset: 'Document',
    enabled: !!projId,
    fields: [{ name: 'project', value: projId }],
    currentPage: 1,
    pageSize: PAGE_SIZE,
    sortBy: '-datePosted',
    queryModifiers: { isFeatured: 'true' }
  });

  if (!result.loading && result.totalListItems === 0) {
    return null;
  }

  const data = {
    ...tableObject({
      tableId: 'documents-table',
      component: DocumentTableRow,
      columns: COLUMNS,
      currentPage: 1,
      pageSize: PAGE_SIZE,
      sortBy: '-datePosted',
      items: result.data.map(record => ({ rowData: record })),
      totalListItems: result.totalListItems,
      data: { lists, showFeatured: true }
    }),
    options: { showHeader: true, showPageCountDisplay: false, showPagination: false, showPageSizePicker: false }
  };

  return (
    <div className="mb-4">
      <h3 className="mb-4">Featured Documents</h3>
      <TableTemplate data={data} loading={result.loading} onMessage={() => undefined} />
    </div>
  );
}
