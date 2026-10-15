import { logger } from 'app/config/logging';
import { rewriteLegacyDocumentUrl } from 'app/utils/legacy-document-url';
import { htmlToText } from 'app/utils/safe-html';
import { fileName } from 'app/utils/safe-url';
import { documentDownloadUrl } from 'app/utils/utils';
import { byIdsNative, getDemiProject, listAllNative, listNative, nativeOrNull } from './api';
import { commentPeriodsQueryOptions } from './commentperiod';
import { queryClient } from './query-client';

export type UpdateKind = 'update' | 'decision';

/** One card of the home Updates feed: an Update, or a project or notification decision. */
export interface HomeUpdate {
  id: string;
  kind: UpdateKind;
  /** The Eagle `_id`, the id project routes take. */
  projectId: string | null;
  projectName: string | null;
  date: string | null;
  headline: string;
  /** The short headline, or the headline when the row has none. */
  shortHeadline: string;
  summary: string | null;
  category: string | null;
  /** TinyMCE HTML, sanitized where it is rendered. */
  content: string | null;
  documentUrl: string | null;
}

/** One image of an Update: the featured image, or one of its series in the order the editor set. */
interface ImageRow {
  /** The Eagle document id. */
  document?: string | null;
  alt?: string | null;
  caption?: string | null;
  credit?: string | null;
}

/**
 * An Update as DEMI's native `/updates` answers it. `id` and `projectId` are Eagle ids. Every field
 * after `documentUrl` is newer than the mirror, so any of them may be missing on an old row.
 */
interface UpdateRow {
  id?: string;
  projectId?: string | null;
  /** Only there when the caller may read the project. */
  projectName?: string | null;
  headline?: string;
  content?: string | null;
  type?: string;
  dateAdded?: string;
  documentUrl?: string | null;
  /** The comment period's id. */
  pcp?: string | null;
  category?: string | null;
  shortHeadline?: string | null;
  summary?: string | null;
  featuredImage?: ImageRow | null;
  images?: ImageRow[] | null;
  /** Eagle document ids. */
  attachments?: (string | null)[] | null;
  location?: string | null;
  engagementUrl?: string | null;
  subject?: string | null;
  status?: string | null;
  publishDate?: string | null;
}

/** A document row as far as an Update reads it. */
interface DocumentRow {
  id?: string;
  displayName?: string | null;
  documentFileName?: string | null;
}

/** What an Update row only references by id, read separately under the caller's own access. */
export interface UpdateRefs {
  /** Documents the caller may read, by id. A reference to any other is dropped. */
  documents: ReadonlyMap<string, DocumentRow>;
  /** Comment periods the caller may read, by id. */
  periods: ReadonlyMap<string, { isMet: boolean; metURL: string | null }>;
  /** The project's address, for an Update that names no location of its own. */
  address?: string | null;
}

const NO_REFS: UpdateRefs = { documents: new Map(), periods: new Map() };

export interface UpdateImage {
  id: string;
  src: string;
  alt: string;
  caption: string | null;
  credit: string | null;
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
  featuredImage: UpdateImage | null;
  /** The photo series shown under the body, in display order. */
  images: UpdateImage[];
  attachments: UpdateDocument[];
  /** The one link an old row carries in place of attachments. */
  documentUrl: string | null;
  /** The file name the stored link ends in, or null. */
  documentName: string | null;
  engagementUrl: string | null;
  commentPeriod: { id: string; isMet: boolean; metURL: string | null } | null;
  /** Headline, short headline, summary and body text, lower-cased once for the tab filter. */
  searchText: string;
}

export const SUMMARY_MAX = 280;

/** One block an editor wrote, so a leading heading or div counts as a paragraph. */
const BLOCK = /<(p|div|h[1-6]|li|blockquote)[\s>][\s\S]*?<\/\1>/gi;

/** The first text the body shows: bare text before any block, else the first block with text. */
function leadingText(content: string): string {
  let rest = 0;
  for (const match of content.matchAll(BLOCK)) {
    const text = htmlToText(content.slice(rest, match.index)) || htmlToText(match[0]);
    if (text) return text;
    rest = match.index + match[0].length;
  }
  return htmlToText(content.slice(rest));
}

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
  return clip(leadingText(content));
}

/**
 * Drafts and archived rows never show. demi-search owns the publishDate gate: the browser clock
 * is not trusted to hide a scheduled Update.
 */
export function isVisibleUpdate(row: Pick<UpdateRow, 'status'>): boolean {
  return row.status == null || row.status === 'published';
}

/** Ids come from the mirror, so they are encoded before they go into a URL path. */
function downloadUrl(id: string): string {
  return documentDownloadUrl({ _id: encodeURIComponent(id) });
}

/** Each readable file once, at its first place, under its name; unnamed ones are numbered. */
function toDocuments(ids: (string | null)[], refs: UpdateRefs): UpdateDocument[] {
  let unnamed = 0;
  return [...new Set(ids)].flatMap((id) => {
    const doc = id ? refs.documents.get(id) : undefined;
    if (!id || !doc) return [];
    const name = doc.displayName || doc.documentFileName || `Document ${++unnamed}`;
    return [{ id, name, href: downloadUrl(id) }];
  });
}

/** Admin and the API both stop an Update at five photos; the gallery grid is laid out for five. */
const MAX_IMAGES = 5;

function toImages(rows: ImageRow[], refs: UpdateRefs): UpdateImage[] {
  const images = rows.flatMap((row) => {
    const id = row.document;
    if (!id || !refs.documents.has(id)) return [];
    const alt = row.alt?.trim() ?? '';
    if (!alt) logger.warn('Update image has no alt text', 'updates', id);
    return [
      {
        id,
        src: downloadUrl(id),
        alt,
        caption: row.caption?.trim() || null,
        credit: row.credit?.trim() || null,
      },
    ];
  });
  return images.slice(0, MAX_IMAGES);
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

/** The card's headline: the short one, or the full one when that is missing or blank. */
function shortHeadlineOf(shortHeadline: string | null | undefined, headline: string): string {
  return shortHeadline?.trim() || headline;
}

export function toUpdate(row: UpdateRow, refs: UpdateRefs = NO_REFS): Update {
  const headline = row.headline ?? '';
  const shortHeadline = shortHeadlineOf(row.shortHeadline, headline);
  const summary = summaryOf(row.summary, row.content);
  const period = row.pcp ? refs.periods.get(row.pcp) : undefined;
  return {
    id: row.id ?? '',
    projectId: row.projectId ?? null,
    projectName: row.projectName ?? null,
    subject: row.subject || null,
    date: row.publishDate || row.dateAdded || null,
    headline,
    shortHeadline,
    summary,
    content: row.content ?? null,
    category: row.category || null,
    type: row.type || null,
    location: row.location || refs.address || null,
    featuredImage: toImages(row.featuredImage ? [row.featuredImage] : [], refs)[0] ?? null,
    images: toImages(row.images ?? [], refs),
    attachments: toDocuments(row.attachments ?? [], refs),
    documentUrl: row.documentUrl ? rewriteLegacyDocumentUrl(row.documentUrl) : null,
    documentName: row.documentUrl ? fileName(row.documentUrl) : null,
    engagementUrl: httpUrl(row.engagementUrl),
    commentPeriod:
      row.pcp && period ? { id: row.pcp, isMet: period.isMet, metURL: period.metURL } : null,
    searchText: [headline, shortHeadline, summary, row.content ? htmlToText(row.content) : '']
      .join(' ')
      .toLowerCase(),
  };
}

/** A feed row as an Update, to show while the reader reads the whole one, or if that read fails. */
export function feedRowToUpdate(row: HomeUpdate): Update {
  return toUpdate({
    id: row.id,
    headline: row.headline,
    shortHeadline: row.shortHeadline,
    summary: row.summary,
    category: row.category,
    content: row.content,
    // The feed answers one date, already `publishDate || dateAdded`.
    publishDate: row.date,
    documentUrl: row.documentUrl,
    projectId: row.projectId,
    projectName: row.projectName,
  });
}

function time(update: Update): number {
  const parsed = Date.parse(update.date ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function newestFirst(a: Update, b: Update): number {
  return time(b) - time(a);
}

/**
 * A `/updates/feed` row: an Update, a project or a notification as its own list answers it, plus
 * `kind` and `feedDate` (an Update's publish date, or a decision date).
 */
interface FeedRow extends UpdateRow {
  kind?: string;
  feedDate?: string | null;
  /** Update: the parent's Eagle `_id`, only there when the caller may read the project. */
  projectEagleId?: string | null;
  /** Project: the Eagle `_id`, absent on a Track-only project. */
  eagleId?: string | null;
  /** Project name, or a notification's own name. */
  name?: string | null;
  eacDecision?: { name?: string | null } | null;
  associatedProjectId?: string | null;
  associatedProjectName?: string | null;
  decision?: string | null;
}

/** How many cards the feed shows. */
const FEED_SIZE = 5;

interface Decision {
  id: string | null | undefined;
  projectId: string | null | undefined;
  projectName: string | null | undefined;
  headline: string | null | undefined;
  date: string | null;
}

function decisionItem({ id, projectId, projectName, headline, date }: Decision): HomeUpdate {
  return {
    id: id ?? '',
    kind: 'decision',
    projectId: projectId || null,
    projectName: projectName || null,
    date,
    headline: headline ?? '',
    shortHeadline: headline ?? '',
    summary: null,
    category: null,
    content: null,
    documentUrl: null,
  };
}

/** A row of a kind this feed does not draw is null. */
function toFeedItem(row: FeedRow): HomeUpdate | null {
  const date = row.feedDate ?? null;
  switch (row.kind) {
    case 'projects':
      return decisionItem({
        id: row.eagleId || row.id,
        projectId: row.eagleId,
        projectName: row.name,
        headline: row.eacDecision?.name,
        date,
      });
    case 'notifications':
      return decisionItem({
        id: row.id,
        projectId: row.associatedProjectId,
        projectName: row.associatedProjectName || row.name,
        headline: row.decision,
        date,
      });
    case 'updates': {
      const headline = row.headline ?? '';
      return {
        id: row.id ?? '',
        kind: 'update',
        projectId: row.projectEagleId ?? null,
        projectName: row.projectName ?? null,
        date,
        headline,
        shortHeadline: shortHeadlineOf(row.shortHeadline, headline),
        summary: row.summary ?? null,
        category: row.category ?? null,
        content: row.content ?? null,
        documentUrl: row.documentUrl ?? null,
      };
    }
    default:
      logger.warn('Home feed skipped a row of an unknown kind', 'updates', { kind: row.kind });
      return null;
  }
}

/**
 * The feed's one read. eagle-demi answers pinned updates first, then News updates and decisions
 * newest first; `type` narrows only the unpinned updates.
 */
async function readHomeFeed(): Promise<HomeUpdate[]> {
  const { rows } = await listNative<FeedRow>('updates/feed', {
    filters: { limit: FEED_SIZE, type: 'News' },
  });
  return rows.map(toFeedItem).filter((item): item is HomeUpdate => !!item?.id);
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
      const row = await nativeOrNull<UpdateRow>('updates', id);
      if (!row || !isVisibleUpdate(row)) return null;
      return toUpdate(row, { ...NO_REFS, documents: await readDocuments([row]) });
    },
  };
}

function documentIdsOf(row: UpdateRow): (string | null | undefined)[] {
  return [
    ...(row.attachments ?? []),
    row.featuredImage?.document,
    ...(row.images ?? []).map((image) => image?.document),
  ];
}

/**
 * The documents the rows reference that the caller may read, by id. A failed read leaves every
 * document out rather than failing every Update.
 */
async function readDocuments(rows: UpdateRow[]): Promise<Map<string, DocumentRow>> {
  const ids = [...new Set(rows.flatMap(documentIdsOf).filter((id): id is string => !!id))];
  try {
    const docs = await byIdsNative<DocumentRow>('documents', ids);
    return new Map(docs.flatMap((doc) => (doc.id ? [[doc.id, doc] as const] : [])));
  } catch (err) {
    logger.warn('Update documents could not be read; left out', 'updates', {
      count: ids.length,
      err,
    });
    return new Map();
  }
}

/** The project's comment periods, by id, read only when an Update links one. */
async function readPeriods(projId: string, rows: UpdateRow[]): Promise<UpdateRefs['periods']> {
  if (!rows.some((row) => row.pcp)) return new Map();
  const periods = await queryClient.fetchQuery(commentPeriodsQueryOptions(projId));
  return new Map(
    periods.map((period) => [period._id, { isMet: !!period.isMet, metURL: period.metURL || null }]),
  );
}

/**
 * Every visible Update of one project, newest first. The tab strip, the Updates tab and the
 * overview panel all read this one cached list, so they never disagree on what is visible.
 */
export function projectUpdatesQueryOptions(projId: string) {
  return {
    queryKey: ['projectUpdates', projId],
    enabled: !!projId,
    // The tab and overview show an error at once and the strip drops the tab; a retry only delays it.
    retry: false,
    queryFn: async (): Promise<Update[]> => {
      // Updates file under the Eagle id.
      const rows = await listAllNative<UpdateRow>('updates', {
        filters: { project: projId },
        sort: '-publishDate',
      });
      // A row written between page reads shifts the pages, so one row can come back twice.
      const seen = new Set<string>();
      const visible = rows.filter((row) => {
        if (!row.id || seen.has(row.id)) return false;
        seen.add(row.id);
        return isVisibleUpdate(row);
      });
      const [documents, periods, project] = await Promise.all([
        readDocuments(visible),
        readPeriods(projId, visible),
        getDemiProject(projId),
      ]);
      const refs = { documents, periods, address: project?.address };
      return visible.map((row) => toUpdate(row, refs)).sort(newestFirst);
    },
  };
}

/** The Updates whose headline, short headline, summary or body text holds every typed word. */
export function filterUpdates(updates: Update[], text: string): Update[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return updates;
  return updates.filter((update) => words.every((word) => update.searchText.includes(word)));
}
