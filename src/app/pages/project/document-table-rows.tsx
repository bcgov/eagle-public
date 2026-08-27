import { useLocation } from 'react-router';
import type { TableRowProps } from 'app/components/table/table-object';
import { idToListName, longDate, openDocumentDownload } from 'app/utils/utils';
import './document-table-rows.css';

/** The API's stand-in for "no date", which must not render as 1900. */
const NO_DATE = '1900-01-01T08:00:00.000Z';

export function DocumentTableRow({ rowData, tableData }: TableRowProps) {
  const { pathname } = useLocation();
  const lists: any[] = tableData.data?.lists ?? [];
  // Search results reuse this row but never show the featured star.
  const showFeatured = !!tableData.data?.showFeatured && !pathname.endsWith('/search');
  const goToItem = () => openDocumentDownload(rowData);

  return (
    <tr
      tabIndex={0}
      onKeyUp={event => {
        if (event.key === 'Enter') goToItem();
      }}
    >
      {showFeatured && (
        <td data-label="★" onClick={goToItem} className="col-1">
          {rowData.isFeatured === true && (
            <i className="material-icons featured-star" aria-hidden="true">
              star
            </i>
          )}
        </td>
      )}

      <td data-label="Name" onClick={goToItem} className={showFeatured ? 'col-3' : 'col-4'}>
        {rowData.displayName}
      </td>

      <td data-label="Date" onClick={goToItem} className="col-2">
        {rowData.datePosted !== NO_DATE && <div>{longDate(rowData.datePosted)}</div>}
      </td>

      <td data-label="Type" onClick={goToItem} className="col-2">
        {idToListName(rowData.type, lists)}
      </td>

      <td data-label="Milestone" onClick={goToItem} className="col-2">
        {idToListName(rowData.milestone, lists)}
      </td>

      <td data-label="Phase" onClick={goToItem} className="col-2">
        {idToListName(rowData.projectPhase, lists)}
      </td>
    </tr>
  );
}
