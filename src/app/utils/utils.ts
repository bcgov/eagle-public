import type { ListRef } from 'app/api/api';
import { Constants } from './constants';
import { DEFAULT_ACT, actFor } from './legislation';
import { documentTabByKey, idsForTerms } from './document-tabs';
import { track } from 'app/analytics/analytics';
import { createBulkDownload } from 'app/api/api';
import { getSearchApiPath } from 'app/config/config';
import { logger } from 'app/config/logging';
import { isSafeUrl } from './safe-url';

// Mapping the build database field to the human readable nature field
export function natureBuildMapper(key: string): string {
  if (!key) {
    return '';
  }
  const natureObj = Constants.buildToNature.find((obj) => obj.build === key);
  return natureObj ? natureObj.nature : key;
}

// Creates query modifiers used for tab display in a project.
export function createProjectTabModifiers(projectTab: string, list: any[]): Record<string, string> {
  // The same name tables the segment resolver reads, so a tab lists exactly what it claims.
  const tab = documentTabByKey(projectTab);
  const typeIds = idsForTerms(tab?.types ?? [], list).join(',');
  const milestoneIds = idsForTerms(tab?.milestones ?? [], list).join(',');
  const phaseIds = idsForTerms(tab?.phases ?? [], list).join(',');

  // Empty ids must not reach the query: an empty filter list matches no documents at all.
  const queryModifier: Record<string, string> = { documentSource: 'PROJECT' };

  if (typeIds) {
    queryModifier['type'] = typeIds;
  }
  if (milestoneIds) {
    queryModifier['milestone'] = milestoneIds;
  }
  if (phaseIds) {
    queryModifier['projectPhase'] = phaseIds;
  }

  return queryModifier;
}

/**
 * Looks up a list item by ID and returns the whole row, for callers that need more than its name.
 * `undefined` when the id is empty, the rows have not loaded, or no row carries that id.
 */
export function idToListRow(id: string, lists: ListRef[]): ListRef | undefined {
  if (!id) return undefined;
  if (!lists?.length) return undefined;

  return lists.find((listItem) => listItem.id === id);
}

/**
 * Looks up a list item by ID and returns its name.
 * Commonly used in table rows to display human-readable names for IDs.
 */
export function idToListName(id: string, lists: ListRef[]): string {
  return idToListRow(id, lists)?.name ?? '-';
}

export interface DownloadableDocument {
  _id: string;
  documentFileName?: string;
  displayName?: string;
  internalOriginalName?: string;
  internalMime?: string;
  fileExt?: string;
}

function downloadFileName(document: DownloadableDocument): string {
  return (
    document.documentFileName || document.displayName || document.internalOriginalName || 'document'
  );
}

/**
 * `redirect=1` makes demi-api answer 302 to the presigned object URL instead of a JSON body, so a
 * plain navigation downloads the file.
 */
export function documentDownloadUrl(document: DownloadableDocument): string {
  return `${getSearchApiPath()}/documents/${document._id}/download?redirect=1`;
}

const INLINE_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const INLINE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg']);
const GENERIC_MIME_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
  'application/x-download',
]);
// demi-api's `isExtension`: anything else is ignored, as it is when demi-api names the file.
const EXTENSION = /^(?=.*[a-z])[a-z0-9]{1,8}$/i;

function validExtension(value: string | undefined): string | undefined {
  return value !== undefined && EXTENSION.test(value) ? value : undefined;
}

/**
 * A subset of demi-api's `inlineType` (PDF, PNG, JPEG): the MIME type decides; when it is missing
 * or generic, the stated `fileExt`, then the name's extension, as demi-api builds the file name.
 */
export function isInlineViewable(document: DownloadableDocument): boolean {
  const mime = (document.internalMime ?? '').split(';')[0].trim().toLowerCase();
  if (mime && !GENERIC_MIME_TYPES.has(mime)) return INLINE_MIME_TYPES.has(mime);
  const extension =
    validExtension(document.fileExt?.trim().replace(/^\.+/, '')) ??
    validExtension(/\.([^./]+)$/.exec(downloadFileName(document))?.[1]) ??
    '';
  return INLINE_EXTENSIONS.has(extension.toLowerCase());
}

/** demi-api streams the file from its own origin with `Content-Disposition: inline`. */
export function documentInlineUrl(document: DownloadableDocument): string {
  return `${getSearchApiPath()}/documents/${document._id}/download?inline=1`;
}

/** The anchor href: the inline view for a file the browser can show, the download otherwise. */
export function documentLinkUrl(document: DownloadableDocument): string {
  return isInlineViewable(document) ? documentInlineUrl(document) : documentDownloadUrl(document);
}

/**
 * Starts a download in a hidden iframe: an attachment downloads without navigating, and an error
 * body (an object-store 404 XML, say) renders inside the iframe instead of replacing the app.
 */
export function triggerDownload(url: string): void {
  if (!isSafeUrl(url)) {
    logger.warn('Ignored a download link with an unsupported URL scheme', 'utils', url);
    return;
  }
  const frame = window.document.createElement('iframe');
  frame.hidden = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.src = url;
  window.document.body.appendChild(frame);
  // Removing the iframe cancels a transfer that has not started yet, so give it a minute.
  window.setTimeout(() => frame.remove(), 60_000);
}

export function trackDocumentDownload(document: DownloadableDocument): void {
  track('Document Downloaded', {
    document_id: document._id,
    document_name: downloadFileName(document),
    document_type: 'unknown',
  });
}

/**
 * Opens a PDF or image in a new tab. Any other file is presigned through demi-api; never rejects,
 * since any answer other than a URL falls back to the redirecting download route.
 */
export function openDocumentDownload(document: DownloadableDocument): void {
  trackDocumentDownload(document);
  // Opened inside the click, before any await, so popup blockers let the tab through.
  if (isInlineViewable(document)) {
    window.open(documentInlineUrl(document), '_blank', 'noopener');
    return;
  }

  const redirectDownload = () => window.open(documentDownloadUrl(document), '_blank');

  void createBulkDownload([document._id])
    .then((result) => {
      const url = (result as { url?: string }).url;
      if (!url) {
        throw new Error('bulk download answered without a url');
      }
      triggerDownload(url);
    })
    .catch((error) => {
      logger.warn('Presigned download failed, falling back to the redirect URL', 'utils', error);
      redirectDownload();
    });
}

/** Angular's `date:'longDate'`, e.g. "August 27, 2026". Empty string for a missing date. */
export function longDate(value: string | Date | undefined | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Angular's `date:'MMM d, y'`, e.g. "Aug 27, 2026". Empty string for a missing date. */
export function mediumDate(value: string | Date | undefined | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** A Regulatory Transfer project's regulation link, falling back to the BC Energy Regulator. */
export function regulatorLink(item: unknown): string {
  return isSafeUrl(item) ? item : Constants.BC_ENERGY_REGULATOR_LINK;
}

/** Link to the Act a project was assessed under; unknown legislation reads as the default Act. */
export function legislationLink(legislation: string | undefined): string {
  return (actFor(legislation) ?? DEFAULT_ACT).href;
}
