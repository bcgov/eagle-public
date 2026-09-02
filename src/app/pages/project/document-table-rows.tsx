import { useLocation } from 'react-router';
import type { TableRowProps } from 'app/components/table/table-object';
import { useDocumentRow } from 'app/components/table/document-row';
import { DownloadCell, SelectCell } from 'app/components/table/table-template';
import { documentDownloadUrl, idToListName, longDate, openDocumentDownload } from 'app/utils/utils';
import './document-table-rows.css';

/** The API's stand-in for "no date", which must not render as 1900. */
const NO_DATE = '1900-01-01T08:00:00.000Z';

export function DocumentTableRow({ rowData, tableData }: TableRowProps) {
  const { pathname } = useLocation();
  const lists: any[] = tableData.data?.lists ?? [];
  // Search results reuse this row but never show the featured star.
  const showFeatured = !!tableData.data?.showFeatured && !pathname.endsWith('/search');
  const { selectable, rowProps } = useDocumentRow(rowData, tableData);

  return (
    <tr {...rowProps}>
      {selectable && <SelectCell rowData={rowData} tableId={tableData.tableId} />}

      {showFeatured && (
        <td data-label="★" className="col-1">
          {rowData.isFeatured === true && (
            <i className="material-icons featured-star" aria-hidden="true">
              star
            </i>
          )}
        </td>
      )}

      <td data-label="Name" className={showFeatured ? 'col-3' : 'col-4'}>
        <a
          href={documentDownloadUrl(rowData)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={event => {
            event.preventDefault();
            openDocumentDownload(rowData);
          }}
        >
          {rowData.displayName}
        </a>
      </td>

      <td data-label="Date" className="col-2">
        {rowData.datePosted !== NO_DATE && <div>{longDate(rowData.datePosted)}</div>}
      </td>

      <td data-label="Type" className="col-2">
        {idToListName(rowData.type, lists)}
      </td>

      <td data-label="Milestone" className="col-2">
        {idToListName(rowData.milestone, lists)}
      </td>

      <td data-label="Phase" className="col-2">
        {idToListName(rowData.projectPhase, lists)}
      </td>

      <DownloadCell rowData={rowData} />
    </tr>
  );
}
