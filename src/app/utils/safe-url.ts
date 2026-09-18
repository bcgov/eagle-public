const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/** True for http/https/mailto URLs and site-relative paths. Everything else is unsafe to open. */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  // "//host" and "/\host" are protocol-relative and leave the site.
  if (value.startsWith('/')) return !/^\/[\\/]/.test(value);
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
