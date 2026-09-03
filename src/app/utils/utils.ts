import type { ISearchResults } from 'app/models/search';
import { Constants } from './constants';
import { track } from 'app/analytics/analytics';
import { createBulkDownload } from 'app/api/api';
import { bulkDownloadEnabled } from 'app/config/config';
import { logger } from 'app/config/logging';

const encode = encodeURIComponent;
(window as any)['encodeURIComponent'] = (component: string | number | boolean) => {
  return encode(String(component)).replace(/[!'()*]/g, (c) => {
    // Also encode !, ', (, ), and *
    return '%' + c.charCodeAt(0).toString(16);
  });
};

export function encodeString(filename: string, isUrl: boolean): string {
  let safeName;
  if (isUrl) {
    safeName = encode(filename)
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
  let types: object[] = [];
  let milestones: object[] = [];
  let phases: string | undefined;

  switch (projectTab) {
    case Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC:
      break;
    case Constants.optionalProjectDocTabs.AMENDMENT: {
      types = [
        { legislation: 2002, name: 'Amendment Package' },
        { legislation: 2018, name: 'Amendment Package' },
        { legislation: 2002, name: 'Request' },
        { legislation: 2002, name: 'Decision Materials' },
        { legislation: 2018, name: 'Decision Materials' },
        { legislation: 2002, name: 'Tracking Table' },
        { legislation: 2018, name: 'Tracking Table' },
      ];
      milestones = [
        { legislation: 2002, name: 'Amendment' },
        { legislation: 2018, name: 'Amendment' },
      ];

      const amendPhase = [
        { legislation: 2002, name: 'Post Decision - Amendment' },
        { legislation: 2018, name: 'Post Decision - Amendment' },
      ];

      // Special case for phases.
      phases = getIdsByName(amendPhase, list)
        .map((phase) => phase.id)
        .join(',');
      break;
    }
    case Constants.optionalProjectDocTabs.CERTIFICATE:
      types = [
        { legislation: 2002, name: 'Certificate Package' },
        { legislation: 2018, name: 'Certificate Package' },
        { legislation: 2002, name: 'Order' },
        { legislation: 2018, name: 'Order' },
        { legislation: 2002, name: 'Decision Materials' },
        { legislation: 2018, name: 'Decision Materials' },
      ];
      milestones = [
        { legislation: 2002, name: 'Certificate' },
        { legislation: 2018, name: 'Certificate Decision' },
        { legislation: 2002, name: 'Decision' },
        { legislation: 2002, name: 'Certificate Extension' },
        { legislation: 2018, name: 'Certificate Extension' },
        { legislation: 2018, name: 'Transfer of Certificate/Order' },
      ];
      break;
    case Constants.optionalProjectDocTabs.COMPLIANCE:
      // Compliance & Enforcement documents carry the milestone but no dedicated document type,
      // so this tab filters on milestone alone.
      milestones = [
        { legislation: 2002, name: 'Compliance & Enforcement' },
        { legislation: 2018, name: 'Compliance & Enforcement' },
      ];
      break;
    case Constants.optionalProjectDocTabs.APPLICATION: {
      // Application documents are identified by type and milestone only.
      // Adding projectPhase filter causes query issues with many AND conditions.
      types = [
        { legislation: 2002, name: 'Application Materials' },
        { legislation: 2018, name: 'Application Materials' },
        { legislation: 2002, name: 'Scientific Memo' },
        { legislation: 2018, name: 'Independent Memo' },
      ];
      milestones = [
        { legislation: 2002, name: 'Application Review' },
        { legislation: 2018, name: 'EAC Application' },
        { legislation: 2018, name: 'Revised EAC Application' },
      ];
      break;
    }
  }

  const typeIds = getIdsByName(types, list)
    .map((type) => type.id)
    .join(',');
  const milestoneIds = getIdsByName(milestones, list)
    .map((milestone) => milestone.id)
    .join(',');

  // Empty ids must not reach the query: api.searchKeywords turns `''` into `&and[type]=`, and
  // eagle-api answers that with nothing at all.
  const queryModifier: Record<string, string> = { documentSource: 'PROJECT' };

  if (typeIds) {
    queryModifier['type'] = typeIds;
  }
  if (milestoneIds) {
    queryModifier['milestone'] = milestoneIds;
  }
  if (phases) {
    queryModifier['projectPhase'] = phases;
  }

  return queryModifier;
}

// Searches the list of terms for a name and legislation year.
export function getIdsByName(terms: any[], list: any[]): { name: string; id: string }[] {
  // A term with no `List` entry yields no id. Angular read `_id` off the undefined match, which
  // threw whenever the lists had not loaded yet and took the whole tab down with it.
  return terms.flatMap((term) => {
    const listItem = list.find(
      (item) => item.name === term.name && item.legislation === term.legislation,
    );
    return listItem ? [{ name: term.name, id: listItem._id }] : [];
  });
}

/**
 * Looks up a list item by ID and returns its name.
 * Commonly used in table rows to display human-readable names for IDs.
 */
export function idToListName(id: string, lists: any[]): string {
  if (!id) return '-';
  if (!lists?.length) return '-';

  const item = lists.find((listItem) => listItem._id === id);
  return item?.name ?? '-';
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

/** The eagle-api download URL. Also the anchor href, so middle-click and copy-link still work. */
export function documentDownloadUrl(document: DownloadableDocument): string {
  return `/api/public/document/${document._id}/download/${encodeString(downloadFileName(document), true)}`;
}

/**
 * Starts a download in a hidden iframe. A `Content-Disposition: attachment` response downloads
 * without navigating; an error body (an object-store 404 XML, say) renders inside the invisible
 * iframe instead of replacing the app.
 */
export function triggerDownload(url: string): void {
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
 * Starts a single document download: presigned through demi-api when it is configured, the
 * eagle-api URL otherwise. Never rejects - anything demi-api does other than answer with a URL
 * falls back to eagle-api, which still serves the file.
 */
export function openDocumentDownload(document: DownloadableDocument): void {
  track('Document Downloaded', {
    document_id: document._id,
    document_name: downloadFileName(document),
    document_type: 'unknown',
  });

  const eagleApiDownload = () => window.open(documentDownloadUrl(document), '_blank');

  if (!bulkDownloadEnabled()) {
    eagleApiDownload();
    return;
  }

  void createBulkDownload([document._id])
    .then((result) => {
      const url = (result as { url?: string }).url;
      if (!url) {
        throw new Error('bulk download answered without a url');
      }
      triggerDownload(url);
    })
    .catch((error) => {
      logger.warn('Presigned download failed, falling back to eagle-api', 'utils', error);
      eagleApiDownload();
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
