import { rowsFrom, searchKeywords } from './api';

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

/** A `HomeFeed` row. For a project decision, `id` is the project's id. */
interface FeedRow {
  kind?: string;
  id?: string;
  projectId?: string | null;
  projectName?: string | null;
  date?: string | null;
  headline?: string;
  content?: string | null;
  documentUrl?: string | null;
}

/** How many cards the feed shows. */
const FEED_SIZE = 5;

// A `RecentActivity` row holds no decisions, so it always reads as an update.
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

function toFeedItem(row: FeedRow): HomeUpdate {
  return {
    id: row.id ?? '',
    kind: row.kind === 'decision' ? 'decision' : 'update',
    projectId: row.projectId ?? null,
    projectName: row.projectName ?? null,
    date: row.date ?? null,
    headline: row.headline ?? '',
    content: row.content ?? null,
    documentUrl: row.documentUrl ?? null,
  };
}

/**
 * The feed's one read. eagle-demi answers pinned updates first, then News updates and decisions
 * newest first, with comment-period updates already left out.
 */
async function readHomeFeed(): Promise<HomeUpdate[]> {
  const envelope = await searchKeywords('', 'HomeFeed', [], 1, FEED_SIZE, '', null);
  return rowsFrom<FeedRow>(envelope)
    .filter((row) => row.id)
    .map(toFeedItem);
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
