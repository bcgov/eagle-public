import { RichTextView } from './rich-text';
import type { ExtendedPage } from './types';
import './extended.css';
import './extended-documents-empty.css';

export interface ExtendedDocumentsEmptyProps {
  content: ExtendedPage;
}

/** The centred empty state the Documents tab shows an extended project page with no documents.
 * It points to where the project's records are published instead. Renders nothing when the
 * content sets no `documents.empty`. */
export function ExtendedDocumentsEmpty({ content }: ExtendedDocumentsEmptyProps) {
  const empty = content.documents?.empty;
  if (!empty) return null;
  return (
    <div className="extended-card extended-documents-empty">
      <i className="material-icons extended-documents-empty__icon" aria-hidden="true">
        folder_open
      </i>
      <h3 className="extended-documents-empty__title">{empty.title}</h3>
      <p className="extended-documents-empty__text extended-copy">
        <RichTextView text={empty.text} />
      </p>
    </div>
  );
}
