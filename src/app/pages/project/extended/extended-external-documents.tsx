import { ContentLink } from './content-link';
import type { ExternalDocument, ExtendedPage } from './types';
import './extended.css';
import './extended-external-documents.css';

export interface ExtendedExternalDocumentsProps {
  content: ExtendedPage;
}

/** "2 Jul 2026 · PDF, 89 pages, French": what a reader needs before opening a file elsewhere. */
function details(doc: ExternalDocument): string {
  const file = [doc.format, `${doc.pages} ${doc.pages === 1 ? 'page' : 'pages'}`];
  if (doc.language) file.push(doc.language.label);
  return [doc.date, file.join(', ')].filter(Boolean).join(' · ');
}

/** Documents other governments published about the project, grouped by publisher and linked where
 * they are hosted. Kept apart from the EPIC documents table, which lists only what the EAO
 * publishes. Renders nothing when the content has no groups. */
export function ExtendedExternalDocuments({ content }: ExtendedExternalDocumentsProps) {
  const external = content.documents?.external;
  if (!external || external.groups.length === 0) return null;
  const { heading, intro, groups } = external;

  return (
    <section
      className="extended-card extended-external-docs"
      aria-labelledby="extended-external-docs-title"
    >
      <h3 id="extended-external-docs-title" className="extended-card__title">
        {heading}
      </h3>
      <p className="extended-external-docs__intro">{intro}</p>

      {groups.map((group) => (
        <div className="extended-external-docs__group" key={group.publisher}>
          <h4 className="extended-external-docs__publisher">{group.publisher}</h4>
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
          <ul role="list" className="extended-link-list extended-external-docs__list">
            {group.items.map((doc) => (
              <li key={doc.href}>
                <ContentLink className="extended-external-docs__link" href={doc.href}>
                  <span lang={doc.language?.code}>{doc.title}</span>
                </ContentLink>
                <p className="extended-external-docs__details">{details(doc)}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
