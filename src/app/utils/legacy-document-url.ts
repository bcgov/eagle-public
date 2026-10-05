import { documentDownloadUrl } from './utils';

/** Hosts that served eagle-api document routes when old links were written; the page's host too. */
const LEGACY_HOSTS = new Set([
  'projects.eao.gov.bc.ca',
  'www.projects.eao.gov.bc.ca',
  'eagle-prod.pathfinder.gov.bc.ca',
  'eagle-dev.apps.silver.devops.gov.bc.ca',
  'eagle-test.apps.silver.devops.gov.bc.ca',
]);

/**
 * The eagle-api routes that serve a document's file, first match wins. `inline` marks the ones that
 * opened a pdf or image in the browser (`protectedOpen`, `publicDownload`); the rest sent it as an
 * attachment (`protectedDownload`).
 */
const DOCUMENT_ROUTES = [
  { pattern: /^\/api\/document\/([0-9a-f]{24})\/fetch\/.+$/i, inline: true },
  { pattern: /^\/api\/document\/([0-9a-f]{24})\/(?:fetch|download)(?:\/.*)?$/i, inline: false },
  { pattern: /^\/api\/public\/document\/([0-9a-f]{24})\/download(?:\/.*)?$/i, inline: true },
];

function bareHost(hostname: string): string {
  return hostname.replace(/\.$/, '');
}

interface LegacyDocument {
  id: string;
  inline: boolean;
  /** `#page=25` and the like, kept so the viewer still opens at the place the author linked. */
  hash: string;
}

function legacyDocument(href: string): LegacyDocument | null {
  let url: URL;
  try {
    // Resolved from the site root, so `../api/...` lands on `/api/...` whatever page draws it.
    url = new URL(href, window.location.origin);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = bareHost(url.hostname);
  if (!LEGACY_HOSTS.has(host) && host !== bareHost(window.location.hostname)) return null;
  for (const { pattern, inline } of DOCUMENT_ROUTES) {
    const match = pattern.exec(url.pathname);
    if (match) return { id: match[1].toLowerCase(), inline, hash: url.hash };
  }
  return null;
}

/**
 * Old data links documents to eagle-api file routes, which this site no longer calls. A link to one
 * of those routes becomes the DEMI download URL for the same document id, asking for an inline file
 * where eagle-api served one inline; anything else comes back unchanged.
 */
export function rewriteLegacyDocumentUrl(href: string): string {
  const legacy = legacyDocument(href);
  if (!legacy) return href;
  const url = documentDownloadUrl({ _id: legacy.id });
  return `${url}${legacy.inline ? '&inline=1' : ''}${legacy.hash}`;
}
