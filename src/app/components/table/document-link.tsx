import type { ReactNode } from 'react';
import { NewTabHint } from 'app/components/new-tab-hint';
import {
  documentLinkUrl,
  isInlineViewable,
  openDocumentDownload,
  trackDocumentDownload,
  type DownloadableDocument,
} from 'app/utils/utils';

/**
 * A document's link: a real href so middle-click and copy-link work. A PDF or image opens in a new
 * tab through the browser's own navigation; any other file downloads on click.
 */
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
  const inline = isInlineViewable(document);
  return (
    <a
      href={documentLinkUrl(document)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (!inline) event.preventDefault();
        onClick?.();
        if (inline) trackDocumentDownload(document);
        else openDocumentDownload(document);
      }}
    >
      {children}
      {inline ? <NewTabHint /> : null}
    </a>
  );
}
