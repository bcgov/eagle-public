import type { PassageHit, PassageRow } from './passage-list';

/**
 * Where a passage sits in its file, in one place. The index does not record page numbers yet, so
 * a hit is only the Nth passage the search returned and the locator is a label. Once a row carries
 * `pageNumbered` the label names the page and links into the file at it, because a browser's PDF
 * viewer honours a `#page=` fragment.
 */
export const PASSAGE_LOCATOR = {
  label(hit: PassageHit): string {
    return `${hit.pageNumbered ? 'Page' : 'Passage'} ${hit.locator}`;
  },

  /** No link where the locator is not a page: a fragment the viewer ignores is a broken promise. */
  href(row: PassageRow, hit: PassageHit): string | undefined {
    return hit.pageNumbered ? `${row.href}#page=${hit.locator}` : undefined;
  },
};
