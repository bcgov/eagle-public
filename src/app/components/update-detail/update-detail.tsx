import { useId, useState } from 'react';
import type { Update, UpdateDocument } from 'app/api/updates';
import { EngagementLink } from 'app/components/engagement-link';
import { NewTabHint } from 'app/components/new-tab-hint';
import { ImageCaption, UpdateGallery } from 'app/components/update-gallery/update-gallery';
import { safeHtml } from 'app/utils/safe-html';
import { fileName, isSafeUrl } from 'app/utils/safe-url';
import { sanitizeWordHtml } from 'app/utils/word-html-sanitizer';
import { ENGAGE_LABEL } from './update-meta';
import './update-detail.css';

/** Attachments, then the single link an older update carries, with any unsafe URL dropped. */
function documentsOf(update: Update): UpdateDocument[] {
  const legacy =
    update.documentUrl && isSafeUrl(update.documentUrl)
      ? [
          {
            id: update.documentUrl,
            name: fileName(update.documentUrl) ?? 'Project documents',
            href: update.documentUrl,
          },
        ]
      : [];
  return [...update.attachments, ...legacy];
}

function Documents({ documents }: { documents: UpdateDocument[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="update-detail__docs">
      <button
        type="button"
        className="update-detail__docs-toggle"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        <span>Documents ({documents.length})</span>
        <i className="material-icons" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </i>
      </button>
      {open && (
        <ul id={listId} className="update-detail__docs-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <a
                className="update-detail__doc"
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="material-icons" aria-hidden="true">
                  insert_drive_file
                </i>
                <span className="link-label">{doc.name}</span>
                <NewTabHint />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The body of one Update: featured image, text, photos, documents and, unless the host shows its
 * own call to action, the ENGAGE link. The reader dialog and the project Updates tab both render it.
 */
export function UpdateBody({
  update,
  engagement = true,
  headingLevel = 3,
}: {
  update: Update;
  engagement?: boolean;
  /** Level of the body's own headings, one below the host's headline. */
  headingLevel?: 3 | 4;
}) {
  const documents = documentsOf(update);
  const image =
    update.featuredImage && isSafeUrl(update.featuredImage.src) ? update.featuredImage : null;
  return (
    <>
      {image &&
        (image.caption || image.credit ? (
          <figure className="update-gallery__item">
            <img className="update-detail__image" src={image.src} alt={image.alt} />
            <ImageCaption image={image} />
          </figure>
        ) : (
          <img className="update-detail__image" src={image.src} alt={image.alt} />
        ))}
      {update.content && (
        <div
          className="update-detail__content"
          dangerouslySetInnerHTML={safeHtml(sanitizeWordHtml(update.content))}
        ></div>
      )}
      <UpdateGallery images={update.images} headingLevel={headingLevel} />
      {documents.length > 0 && <Documents documents={documents} />}
      {engagement && update.engagementUrl && (
        <p className="update-detail__engage">
          <EngagementLink isMet metURL={update.engagementUrl} label={ENGAGE_LABEL} />
        </p>
      )}
    </>
  );
}
