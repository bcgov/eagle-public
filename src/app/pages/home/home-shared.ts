import type { UpdateKind } from 'app/api/updates';

/** The label each kind carries. Its rule and ink colours live in home.css as `--<kind>` modifiers. */
export const KIND_LABELS: Record<UpdateKind, string> = {
  update: 'Update',
  decision: 'Decision',
};

/**
 * The sort the document tables land on. `datePosted` is the only date those tables hold a column
 * for; the feed's own `dateUploaded` is not a sortable field there.
 */
const NEWEST_FIRST = '-datePosted';

/** The project's All Documents table, newest first. Takes the Eagle `_id`: no route resolves a DEMI id. */
export function projectDocumentsHref(eagleProjectId: string): string {
  return `/p/${eagleProjectId}/documents?sortBy=${NEWEST_FIRST}`;
}
