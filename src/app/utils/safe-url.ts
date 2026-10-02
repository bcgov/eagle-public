const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

const SITE_ORIGIN = 'https://site.invalid';

/** True when `href` holds a control character or whitespace. */
export function hasControlOrSpace(href: string): boolean {
  return /\s/u.test(href) || [...href].some((ch) => ch < ' ' || (ch >= '\u007f' && ch <= '\u009f'));
}

/**
 * True for a path on this site: one leading `/` that stays on this origin. URL parsing drops tab,
 * LF and CR, so `/\t/host` would read as `//host`; any control character or space is refused.
 */
export function isSitePath(href: string): boolean {
  if (hasControlOrSpace(href) || !href.startsWith('/')) return false;
  try {
    return new URL(href, SITE_ORIGIN).origin === SITE_ORIGIN;
  } catch {
    return false;
  }
}

/** True for http/https/mailto URLs and site-relative paths. Everything else is unsafe to open. */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  if (value.startsWith('/')) return isSitePath(value);
  // The URL parser strips what the browser strips, so the scheme check holds; stored links can
  // end in a space, so whitespace alone does not refuse an absolute URL.
  try {
    return SAFE_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** The file name a document URL ends in, or null when the URL points at a folder or a page. */
export function fileName(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (!/\.[a-z0-9]{2,5}$/i.test(last)) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
