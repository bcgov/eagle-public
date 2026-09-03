import { Link } from 'react-router';
import type { TableRowProps } from 'app/components/table/table-object';
import { useDocumentRow } from 'app/components/table/document-row';
import { DocumentLink } from 'app/components/table/document-link';
import { SelectCell } from 'app/components/table/table-template';
import { Constants } from 'app/utils/constants';
import { idToListName, longDate } from 'app/utils/utils';

export function DocSearchTableRow({ rowData, tableData }: TableRowProps) {
  const lists: any[] = tableData?.data?.lists || [];
  const { selectable, rowProps } = useDocumentRow(rowData, tableData);

  return (
    <tr {...rowProps}>
      {selectable && <SelectCell rowData={rowData} tableId={tableData.tableId} />}

      <td data-label="Name" className="col-4">
        <DocumentLink document={rowData}>{rowData.displayName}</DocumentLink>
      </td>

      <td data-label="ProjectName" className="col-2">
        <Link
          aria-label={`Link to project ${rowData.project.name}`}
          to={`/p/${rowData.project._id}/project-details`}
        >
          {rowData.project.name}
        </Link>
      </td>

      <td data-label="Date" className="col-2">
        {rowData.datePosted !== Constants.NO_DATE && <div>{longDate(rowData.datePosted)}</div>}
      </td>

      <td data-label="Type" className="col-2">
        {idToListName(rowData.type, lists)}
      </td>

      <td data-label="Milestone" className="col-2">
        {idToListName(rowData.milestone, lists)}
      </td>
    </tr>
  );
}
