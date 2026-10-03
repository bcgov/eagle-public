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

/** The project's All Documents table, newest first. Takes the raw Eagle `_id`: no route resolves a DEMI id. */
export function projectDocumentsHref(eagleProjectId: string): string {
  return `/p/${encodeURIComponent(eagleProjectId)}/documents?sortBy=${NEWEST_FIRST}`;
}

/** The feed's heading, also the anchor the reader links back to. */
export const UPDATES_HEADING_ID = 'home-updates-heading';
