import type { TableRowProps } from 'app/components/table/table-object';
import { useDocumentRow } from 'app/components/table/document-row';
import { DownloadCell } from 'app/components/table/table-template';
import { documentDownloadUrl, idToListName, longDate, openDocumentDownload } from 'app/utils/utils';

export function ProjectNotificationDocumentsTableRow({ rowData, tableData }: TableRowProps) {
  const background = tableData.data?.rowBackgroundColor || '#F7F8FA';
  const { rowProps } = useDocumentRow(rowData, tableData);

  return (
    <tr {...rowProps}>
      <td data-label="Document Name" style={{ backgroundColor: background }}>
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
      <td data-label="Date" style={{ backgroundColor: background }}>
        {longDate(rowData.datePosted)}
      </td>
      <td data-label="Document Author" style={{ backgroundColor: background }}>
        {idToListName(rowData.documentAuthor, tableData.data?.lists ?? [])}
      </td>
      <DownloadCell rowData={rowData} />
    </tr>
  );
}
