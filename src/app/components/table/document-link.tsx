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
  onClick,
}: {
  document: DownloadableDocument;
  children: ReactNode;
  /** Runs before the download starts, for a caller that reports where the click came from. */
  onClick?: () => void;
}) {
  return (
    <a
      href={documentDownloadUrl(document)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
        openDocumentDownload(document);
      }}
    >
      {children}
    </a>
  );
}
