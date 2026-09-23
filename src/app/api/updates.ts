import { htmlToText } from 'app/utils/safe-html';
import { documentDownloadUrl, type DownloadableDocument } from 'app/utils/utils';
import { ALL_ROWS_PAGE_SIZE, rowsFrom, searchKeywords, totalFrom } from './api';

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
  shortHeadline: string | null;
  summary: string | null;
  category: string | null;
  /** TinyMCE HTML, sanitized where it is rendered. */
  content: string | null;
  documentUrl: string | null;
}

/** A document reference as demi-search answers it: a bare id, or the row when populated. */
type DocumentRef = string | (Partial<DownloadableDocument> & { _id?: string }) | null;

/**
 * A `RecentActivity` row as demi-search stores it. Every field after `project` is newer than the
 * index, so any of them may be missing on an old row.
 */
interface ActivityRow {
  _id?: string;
  headline?: string;
  content?: string | null;
  type?: string;
  active?: boolean;
  dateAdded?: string;
  documentUrl?: string | null;
  project?: { _id?: string; name?: string; location?: string } | null;
  pcp?: { _id?: string; isMet?: boolean; metURL?: string } | null;
  category?: string | null;
  shortHeadline?: string | null;
  summary?: string | null;
  featuredImage?: { document?: DocumentRef; alt?: string | null } | null;
  attachments?: DocumentRef[] | null;
  location?: string | null;
  engagementUrl?: string | null;
  subject?: string | null;
  status?: string | null;
  publishDate?: string | null;
}

export interface UpdateDocument {
  id: string;
  name: string;
  href: string;
}

/** One Update, whole: what the project Updates tab and the `/updates/:id` reader render. */
export interface Update {
  id: string;
  projectId: string | null;
  projectName: string | null;
  /** What a Corporate update is about, in place of a project. */
  subject: string | null;
  /** `publishDate`, or `dateAdded` on a row older than it. */
  date: string | null;
  headline: string;
  shortHeadline: string;
  summary: string;
  /** TinyMCE HTML, sanitized where it is rendered. */
  content: string | null;
  category: string | null;
  type: string | null;
  location: string | null;
  featuredImage: { src: string; alt: string } | null;
  attachments: UpdateDocument[];
  /** The one link an old row carries in place of attachments. */
  documentUrl: string | null;
  engagementUrl: string | null;
  commentPeriod: { id: string; isMet: boolean; metURL: string | null } | null;
  /** Headline, short headline, summary and body text, lower-cased once for the tab filter. */
  searchText: string;
}

export const SUMMARY_MAX = 280;

/** The first block an editor wrote, so a leading heading or div counts as the first paragraph. */
const LEADING_BLOCK = /<(p|div|h[1-6]|li|blockquote)[\s>][\s\S]*?<\/\1>/i;

/** Text cut to `SUMMARY_MAX` at a word boundary, with an ellipsis when anything was cut. */
function clip(text: string): string {
  if (text.length <= SUMMARY_MAX) return text;
  const cut = text.slice(0, SUMMARY_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The summary, or the contract's fallback: the body's first block as text. Both capped at 280. */
export function summaryOf(summary: string | null | undefined, content: string | null | undefined) {
  if (summary?.trim()) return clip(summary.trim());
  if (!content) return '';
  return clip(htmlToText(LEADING_BLOCK.exec(content)?.[0] ?? content));
}

/**
 * Drafts and archived rows never show. demi-search owns the publishDate gate: the browser clock
 * is not trusted to hide a scheduled Update.
 */
export function isVisibleUpdate(row: Pick<ActivityRow, 'status'>): boolean {
  return row.status == null || row.status === 'published';
}

function refId(ref: DocumentRef | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : (ref._id ?? null);
}

function refName(ref: DocumentRef | undefined): string | null {
  if (!ref || typeof ref === 'string') return null;
  return ref.displayName || ref.documentFileName || ref.internalOriginalName || null;
}

function toDocuments(refs: DocumentRef[]): UpdateDocument[] {
  return refs
    .filter((ref) => refId(ref))
    .map((ref, index) => {
      const id = refId(ref) as string;
      return {
        id,
        name: refName(ref) ?? `Document ${index + 1}`,
        href: documentDownloadUrl({ _id: id }),
      };
    });
}

/** ENGAGE links leave the site, so only http and https pass. */
function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
}

export function toUpdate(row: ActivityRow): Update {
  const headline = row.headline ?? '';
  const shortHeadline = row.shortHeadline?.trim() || headline;
  const summary = summaryOf(row.summary, row.content);
  const imageId = refId(row.featuredImage?.document);
  return {
    id: row._id ?? '',
    projectId: row.project?._id ?? null,
    projectName: row.project?.name ?? null,
    subject: row.subject || null,
    date: row.publishDate || row.dateAdded || null,
    headline,
    shortHeadline,
    summary,
    content: row.content ?? null,
    category: row.category || null,
    type: row.type || null,
    location: row.location || row.project?.location || null,
    featuredImage: imageId
      ? { src: documentDownloadUrl({ _id: imageId }), alt: row.featuredImage?.alt ?? '' }
      : null,
    attachments: toDocuments(row.attachments ?? []),
    documentUrl: row.documentUrl ?? null,
    engagementUrl: httpUrl(row.engagementUrl),
    commentPeriod: row.pcp?._id
      ? { id: row.pcp._id, isMet: !!row.pcp.isMet, metURL: row.pcp.metURL ?? null }
      : null,
    searchText: [headline, shortHeadline, summary, row.content ? htmlToText(row.content) : '']
      .join(' ')
      .toLowerCase(),
  };
}

/** A feed row as an Update, to show while the reader reads the whole one, or if that read fails. */
export function feedRowToUpdate(row: HomeUpdate): Update {
  return toUpdate({
    _id: row.id,
    headline: row.headline,
    shortHeadline: row.shortHeadline,
    summary: row.summary,
    category: row.category,
    content: row.content,
    // The feed answers one date, already `publishDate || dateAdded`.
    publishDate: row.date,
    documentUrl: row.documentUrl,
    project: row.projectId ? { _id: row.projectId, name: row.projectName ?? undefined } : null,
  });
}

function time(update: Update): number {
  const parsed = Date.parse(update.date ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function newestFirst(a: Update, b: Update): number {
  return time(b) - time(a);
}

/** A `HomeFeed` row. For a project decision, `id` is the project's id. */
interface FeedRow {
  kind?: string;
  id?: string;
  projectId?: string | null;
  projectName?: string | null;
  date?: string | null;
  publishDate?: string | null;
  headline?: string;
  shortHeadline?: string | null;
  summary?: string | null;
  category?: string | null;
  content?: string | null;
  documentUrl?: string | null;
}

/** How many cards the feed shows. */
const FEED_SIZE = 5;

function toFeedItem(row: FeedRow): HomeUpdate {
  return {
    id: row.id ?? '',
    kind: row.kind === 'decision' ? 'decision' : 'update',
    projectId: row.projectId ?? null,
    projectName: row.projectName ?? null,
    date: row.date ?? row.publishDate ?? null,
    headline: row.headline ?? '',
    shortHeadline: row.shortHeadline ?? null,
    summary: row.summary ?? null,
    category: row.category ?? null,
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

/** One visible Update by id, for the reader opened from a shared or emailed `/updates/:id` link. */
export function updateQueryOptions(id: string) {
  return {
    queryKey: ['update', id],
    enabled: !!id,
    retry: false,
    queryFn: async (): Promise<Update | null> => {
      const envelope = await searchKeywords(
        '',
        'RecentActivity',
        [],
        1,
        1,
        '',
        null,
        { _id: encodeURIComponent(id) },
        true,
      );
      const row = rowsFrom<ActivityRow>(envelope)[0];
      return row && isVisibleUpdate(row) ? toUpdate(row) : null;
    },
  };
}

/** One page of a project's Updates, with demi-search's count of all of them. */
async function readProjectPage(projId: string, page: number) {
  const envelope = await searchKeywords(
    '',
    'RecentActivity',
    [],
    page,
    ALL_ROWS_PAGE_SIZE,
    '',
    '-publishDate',
    { project: projId },
    true,
  );
  return { rows: rowsFrom<ActivityRow>(envelope), total: totalFrom(envelope) ?? 0 };
}

/**
 * Every visible Update of one project, newest first. The tab strip, the Updates tab and the
 * overview panel all read this one cached list, so they never disagree on what is visible.
 */
export function projectUpdatesQueryOptions(projId: string) {
  return {
    queryKey: ['projectUpdates', projId],
    enabled: !!projId,
    queryFn: async (): Promise<Update[]> => {
      const first = await readProjectPage(projId, 1);
      const rows = [...first.rows];
      // Page until the count is reached; an empty page ends it early so a stale count cannot loop.
      for (let page = 2; rows.length < first.total; page++) {
        const next = await readProjectPage(projId, page);
        if (next.rows.length === 0) break;
        rows.push(...next.rows);
      }
      // A row written between page reads shifts the pages, so one row can come back twice.
      const seen = new Set<string>();
      return rows
        .filter((row) => {
          if (!row._id || seen.has(row._id)) return false;
          seen.add(row._id);
          return isVisibleUpdate(row);
        })
        .map(toUpdate)
        .sort(newestFirst);
    },
  };
}

/** The Updates whose headline, short headline, summary or body text holds every typed word. */
export function filterUpdates(updates: Update[], text: string): Update[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return updates;
  return updates.filter((update) => words.every((word) => update.searchText.includes(word)));
}
