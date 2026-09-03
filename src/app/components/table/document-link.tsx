import type { ReactNode } from 'react';
import {
  documentDownloadUrl,
  openDocumentDownload,
  type DownloadableDocument,
} from 'app/utils/utils';

/** A document's download link: a real href so middle-click and copy-link work, click downloads. */
export function DocumentLink({
  document,
  children,
}: {
  document: DownloadableDocument;
  children: ReactNode;
}) {
  return (
    <a
      href={documentDownloadUrl(document)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault();
        openDocumentDownload(document);
      }}
    >
      {children}
    </a>
  );
}
