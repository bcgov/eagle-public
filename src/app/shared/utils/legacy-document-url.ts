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

/** Link and image attributes that may point at a legacy document route. */
const URL_ATTRIBUTES: [string, string, (value: string, searchPath: string) => string][] = [
  ['a[href]', 'href', rewriteLegacyDocumentUrl],
  ['area[href]', 'href', rewriteLegacyDocumentUrl],
  ['img[src]', 'src', rewriteLegacyDocumentUrl],
  ['img[srcset]', 'srcset', rewriteSrcset],
  ['source[srcset]', 'srcset', rewriteSrcset],
];

export interface DocumentUrlOptions { inline?: boolean }

/**
 * The demi-search download URL for one document. `redirect=1` makes demi-api answer 302 to the
 * file, so a plain navigation downloads it. `inline` asks DEMI to let the browser show PDFs and
 * images instead; other types, and a DEMI without the parameter, still download.
 */
export function documentDownloadUrl(searchPath: string, id: string, { inline = false }: DocumentUrlOptions = {}): string {
  return `${searchPath}/documents/${encodeURIComponent(id)}/download?redirect=1${inline ? '&inline=1' : ''}`;
}

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
  if (url.protocol !== 'http:' && url.protocol !== 'https:') { return null; }
  const host = bareHost(url.hostname);
  if (!LEGACY_HOSTS.has(host) && host !== bareHost(window.location.hostname)) { return null; }
  for (const route of DOCUMENT_ROUTES) {
    const match = route.exec(url.pathname);
    if (match) { return match[1].toLowerCase(); }
  }
  return null;
}

/**
 * Old data links documents to eagle-api file routes, which this site no longer calls. A link to one
 * of those routes opened the file in the browser, so it becomes the inline DEMI URL for the same
 * document id; anything else comes back unchanged.
 */
export function rewriteLegacyDocumentUrl(href: string, searchPath: string): string {
  const id = legacyDocumentId(href);
  return id ? documentDownloadUrl(searchPath, id, { inline: true }) : href;
}

/** Rewrites the URL that leads each comma-separated `srcset` candidate; descriptors and spacing stay. */
function rewriteSrcset(srcset: string, searchPath: string): string {
  return srcset.split(',').map(candidate => candidate.replace(/\S+/, url => rewriteLegacyDocumentUrl(url, searchPath))).join(',');
}

/** Staff-authored HTML with every legacy document link and image source rewritten. */
export function rewriteLegacyDocumentLinks(html: string, searchPath: string): string {
  if (!html) { return html; }
  // A template's content is inert, so no image is fetched while the links are rewritten.
  const template = window.document.createElement('template');
  template.innerHTML = html;
  for (const [selector, attribute, rewrite] of URL_ATTRIBUTES) {
    template.content.querySelectorAll(selector).forEach(element => {
      element.setAttribute(attribute, rewrite(element.getAttribute(attribute) ?? '', searchPath));
    });
  }
  return template.innerHTML;
}
