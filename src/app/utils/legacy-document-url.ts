import { documentDownloadUrl } from './utils';

/** Hosts that served eagle-api document routes when old links were written; the page's host too. */
const LEGACY_HOSTS = new Set([
  'projects.eao.gov.bc.ca',
  'www.projects.eao.gov.bc.ca',
  'eagle-prod.pathfinder.gov.bc.ca',
  'eagle-dev.apps.silver.devops.gov.bc.ca',
  'eagle-test.apps.silver.devops.gov.bc.ca',
]);

/** The eagle-api routes that serve a document's file, with any file name tail. */
const DOCUMENT_ROUTES = [
  /^\/api\/document\/([0-9a-f]{24})\/(?:fetch|download)(?:\/.*)?$/i,
  /^\/api\/public\/document\/([0-9a-f]{24})\/download(?:\/.*)?$/i,
];

function bareHost(hostname: string): string {
  return hostname.replace(/\.$/, '');
}

function legacyDocumentId(href: string): string | null {
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
  for (const route of DOCUMENT_ROUTES) {
    const match = route.exec(url.pathname);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/**
 * Old data links documents to eagle-api file routes, which this site no longer calls. A link to one
 * of those routes becomes the DEMI download URL for the same document id; anything else comes back
 * unchanged.
 */
export function rewriteLegacyDocumentUrl(href: string): string {
  const id = legacyDocumentId(href);
  return id ? documentDownloadUrl({ _id: id }) : href;
}
