import type { TableRowProps } from 'app/components/table/table-object';
import { idToListName, longDate, openDocumentDownload } from 'app/utils/utils';

export function ProjectNotificationDocumentsTableRow({ rowData, tableData }: TableRowProps) {
  const background = tableData.data?.rowBackgroundColor || '#F7F8FA';
  const goToItem = () => openDocumentDownload(rowData);

  return (
    <tr
      tabIndex={0}
      onKeyUp={event => {
        if (event.key === 'Enter') goToItem();
      }}
    >
      <td data-label="Document Name" onClick={goToItem} style={{ backgroundColor: background }}>
        {rowData.displayName}
      </td>
      <td data-label="Date" onClick={goToItem} style={{ backgroundColor: background }}>
        {longDate(rowData.datePosted)}
      </td>
      <td data-label="Document Author" onClick={goToItem} style={{ backgroundColor: background }}>
        {idToListName(rowData.documentAuthor, tableData.data?.lists ?? [])}
      </td>
    </tr>
  );
}
