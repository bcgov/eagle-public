import type { TableRowProps } from 'app/components/table/table-object';
import { useDocumentRow } from 'app/components/table/document-row';
import { DocumentLink } from 'app/components/table/document-link';
import { idToListName, longDate } from 'app/utils/utils';

export function ProjectNotificationDocumentsTableRow({ rowData, tableData }: TableRowProps) {
  const background = tableData.data?.rowBackgroundColor || '#F7F8FA';
  const { rowProps } = useDocumentRow(rowData, tableData);

  return (
    <tr {...rowProps}>
      <td data-label="Document Name" style={{ backgroundColor: background }}>
        <DocumentLink document={rowData}>{rowData.displayName}</DocumentLink>
      </td>
      <td data-label="Date" style={{ backgroundColor: background }}>
        {longDate(rowData.datePosted)}
      </td>
      <td data-label="Document Author" style={{ backgroundColor: background }}>
        {idToListName(rowData.documentAuthor, tableData.data?.lists ?? [])}
      </td>
    </tr>
  );
}
