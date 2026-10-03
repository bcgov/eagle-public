import { ListRow } from 'app/components/display-grid/list-row';
import type { Comment } from 'app/models/comment';
import type { Document } from 'app/models/document';
import { documentDownloadUrl, longDate, openDocumentDownload } from 'app/utils/utils';

/**
 * One public comment in the activities row: the commenter as the headline, date and place in the
 * meta line, the comment as the body, its files as the row's documents.
 */
export function CommentRow({ row }: { row: Comment & { Anonymous?: boolean } }) {
  // eagle-api drops the author field entirely on anonymous comments.
  const anonymous = !row.author || row.Anonymous === true;
  // loadComments has already swapped the ids for the documents they name.
  const documents: Document[] = row.documents ?? [];

  return (
    <ListRow
      meta={[longDate(row.dateAdded) || '-', ...(!anonymous && row.location ? [row.location] : [])]}
      title={anonymous ? 'Anonymous' : String(row.author)}
      body={row.comment || undefined}
      attachments={documents.map((doc) => ({
        name: doc.internalOriginalName || doc.displayName || 'Attachment',
        href: documentDownloadUrl(doc),
        onClick: () => openDocumentDownload(doc),
      }))}
    />
  );
}
