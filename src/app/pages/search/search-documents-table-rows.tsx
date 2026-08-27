import { Link } from 'react-router';
import type { TableRowProps } from 'app/components/table/table-object';
import { idToListName, longDate, openDocumentDownload } from 'app/utils/utils';
import './search-documents-table-rows.css';

/** Placeholder date the API stores for a document with no posting date; never shown. */
const NO_DATE = '1900-01-01T08:00:00.000Z';

export function DocSearchTableRow({ rowData, tableData }: TableRowProps) {
  const lists: any[] = tableData?.data?.lists || [];

  return (
    <tr>
      <td data-label="Name" className="col-3">
        {rowData.displayName}
      </td>
      <td data-label="ProjectName" className="col-2">
        <Link
          aria-label={`Link to project ${rowData.project.name}`}
          to={`/p/${rowData.project._id}/project-details`}
          tabIndex={0}
        >
          {rowData.project.name}
        </Link>
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
      <td data-label="Download" className="col-1 d-flex justify-content-center">
        <span
          className="material-icons download-icon"
          onClick={() => openDocumentDownload(rowData)}
          onKeyUp={event => {
            if (event.key === 'Enter') openDocumentDownload(rowData);
          }}
          tabIndex={0}
          role="button"
          aria-label="Download document button"
        >
          cloud_download
        </span>
      </td>
    </tr>
  );
}
