import { Link } from 'react-router';
import type { TableRowProps } from 'app/components/table/table-object';
import { useDocumentRow } from 'app/components/table/document-row';
import { DownloadCell, SelectCell } from 'app/components/table/table-template';
import { documentDownloadUrl, idToListName, longDate, openDocumentDownload } from 'app/utils/utils';

/** Placeholder date the API stores for a document with no posting date; never shown. */
const NO_DATE = '1900-01-01T08:00:00.000Z';

export function DocSearchTableRow({ rowData, tableData }: TableRowProps) {
  const lists: any[] = tableData?.data?.lists || [];
  const { selectable, rowProps } = useDocumentRow(rowData, tableData);

  return (
    <tr {...rowProps}>
      {selectable && <SelectCell rowData={rowData} tableId={tableData.tableId} />}

      <td data-label="Name" className="col-3">
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

      <td data-label="ProjectName" className="col-2">
        <Link aria-label={`Link to project ${rowData.project.name}`} to={`/p/${rowData.project._id}/project-details`}>
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

      <DownloadCell rowData={rowData} />
    </tr>
  );
}
