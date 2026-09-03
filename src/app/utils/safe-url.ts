import { logger } from 'app/config/logging';

const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/** True for http/https/mailto URLs and site-relative paths. Everything else is unsafe to open. */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  // A protocol-relative "//host" path leaves the site, so treat it as absolute.
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    return SAFE_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Opens an API-supplied link in a new tab, dropping anything that is not a safe URL. */
export function openExternal(url: unknown): void {
  if (!isSafeUrl(url)) {
    logger.warn('Ignored a link with an unsupported URL scheme', 'safe-url', url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
