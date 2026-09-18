import { getTopNewsItems, rowsFrom, searchKeywords } from './api';

export type UpdateKind = 'update' | 'decision';

/** One row of the home Updates feed, in the shape the merged updates-and-decisions feed answers. */
export interface HomeUpdate {
  id: string;
  kind: UpdateKind;
  /** The Eagle `_id`, the id project routes take. */
  projectId: string | null;
  projectName: string | null;
  date: string | null;
  headline: string;
  /** TinyMCE HTML, sanitized where it is rendered. */
  content: string | null;
  documentUrl: string | null;
}

/** A `RecentActivity` row as demi-search stores it. */
interface ActivityRow {
  _id?: string;
  headline?: string;
  content?: string | null;
  type?: string;
  active?: boolean;
  dateAdded?: string;
  documentUrl?: string | null;
  project?: { _id?: string; name?: string } | null;
}

/** Activity types the feed shows. Comment-period activity belongs to the rail, not the feed. */
const UPDATE_TYPES = new Set(['News', 'Project Notification News']);

// `RecentActivity` has no decision type, so every activity reads as an update.
function toUpdate(row: ActivityRow): HomeUpdate {
  return {
    id: row._id ?? '',
    kind: 'update',
    projectId: row.project?._id ?? null,
    projectName: row.project?.name ?? null,
    date: row.dateAdded ?? null,
    headline: row.headline ?? '',
    content: row.content ?? null,
    documentUrl: row.documentUrl ?? null,
  };
}

/**
 * The feed's one read. It is the pinned-first `top=true` strip until eagle-demi serves the merged
 * updates-and-decisions feed; swapping the source happens here and nowhere else.
 */
async function readHomeFeed(): Promise<HomeUpdate[]> {
  const rows: ActivityRow[] = await getTopNewsItems();
  return rows
    .filter((row) => row._id && row.active && UPDATE_TYPES.has(row.type ?? ''))
    .map(toUpdate);
}

export function homeFeedQueryOptions() {
  return {
    queryKey: ['homeFeed'],
    queryFn: readHomeFeed,
    // The feed shows its own error in place; retrying only holds the skeleton up.
    retry: false,
  };
}

/** One update by id, for a reader opened cold from a shared or emailed `/updates/:id` link. */
export function updateQueryOptions(id: string) {
  return {
    queryKey: ['update', id],
    enabled: !!id,
    retry: false,
    queryFn: async (): Promise<HomeUpdate | null> => {
      const envelope = await searchKeywords('', 'RecentActivity', [], 1, 1, '', null, {
        _id: encodeURIComponent(id),
      });
      const row = rowsFrom<ActivityRow>(envelope)[0];
      return row ? toUpdate(row) : null;
    },
  };
}
