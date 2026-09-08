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
