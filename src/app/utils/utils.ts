import type { ISearchResults } from 'app/models/search';
import type { ListRef } from 'app/api/api';
import { Constants } from './constants';
import { documentTabByKey, idsForTerms } from './document-tabs';
import { track } from 'app/analytics/analytics';
import { createBulkDownload } from 'app/api/api';
import { getSearchApiPath } from 'app/config/config';
import { logger } from 'app/config/logging';
import { isSafeUrl } from './safe-url';

export function encodeString(filename: string, isUrl: boolean): string {
  let safeName;
  if (isUrl) {
    safeName = encodeURIComponent(filename)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\\/g, '_')
      .replace(/\//g, '_')
      .replace(/%2F/g, '_')
      .replace(/ /g, '_');
    return safeName;
  } else {
    safeName = filename
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\\/g, '_')
      .replace(/\//g, '_');
    return safeName;
  }
}

// This function will take in a ISearchResults of some type and return an array of that same type
export function extractFromSearchResults<T>(results: ISearchResults<T>[]): T[] | null {
  if (!results || !Array.isArray(results)) {
    return null;
  }
  // WHY: the Array.isArray guard above does not cover an EMPTY array - `results[0].data`
  // on `[]` threw a TypeError before anything downstream could handle it. Callers hand us
  // whatever the search backend produced, and that is `[]` whenever it answers 2xx with no
  // result envelope. Optional-chaining here fixes it once for every caller instead of at each
  // call site.
  const data = results[0]?.data;
  if (!data) {
    return null;
  }
  // `?? null` because the declared `T[] | null` was a lie without it: a data-bearing envelope
  // carrying no `searchResults` returned `undefined`, and the `as T[]` cast hid that from every
  // caller's type.
  return (data.searchResults ?? null) as T[] | null;
}

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

  // Empty ids must not reach the query: api.searchKeywords turns `''` into `&and[type]=`, and
  // eagle-api answers that with nothing at all.
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
export function idToListRow(id: string, lists: any[]): ListRef | undefined {
  if (!id) return undefined;
  if (!lists?.length) return undefined;

  return lists.find((listItem) => listItem._id === id);
}

/**
 * Looks up a list item by ID and returns its name.
 * Commonly used in table rows to display human-readable names for IDs.
 */
export function idToListName(id: string, lists: any[]): string {
  return idToListRow(id, lists)?.name ?? '-';
}

export interface DownloadableDocument {
  _id: string;
  documentFileName?: string;
  displayName?: string;
  internalOriginalName?: string;
}

function downloadFileName(document: DownloadableDocument): string {
  return (
    document.documentFileName || document.displayName || document.internalOriginalName || 'document'
  );
}

/**
 * The demi-search download URL. Also the anchor href, so middle-click and copy-link still work.
 * `redirect=1` makes demi-api answer 302 to the presigned object URL instead of a JSON body, so a
 * plain navigation downloads the file.
 */
export function documentDownloadUrl(document: DownloadableDocument): string {
  return `${getSearchApiPath()}/documents/${document._id}/download?redirect=1`;
}

/**
 * Starts a download in a hidden iframe. A `Content-Disposition: attachment` response downloads
 * without navigating; an error body (an object-store 404 XML, say) renders inside the invisible
 * iframe instead of replacing the app.
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

/**
 * Starts a single document download: presigned through demi-api first, its redirecting download
 * route otherwise. Never rejects - anything demi-api does other than answer with a URL falls back
 * to that route, which still serves the file.
 */
export function openDocumentDownload(document: DownloadableDocument): void {
  track('Document Downloaded', {
    document_id: document._id,
    document_name: downloadFileName(document),
    document_type: 'unknown',
  });

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

/** bclaws link for the Act a project was assessed under; unknown legislation reads as 2018. */
export function legislationLink(legislation: string | undefined): string {
  if (legislation?.includes('2002')) {
    return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK;
  }
  if (legislation?.includes('1996')) {
    return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK;
  }
  return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK;
}
