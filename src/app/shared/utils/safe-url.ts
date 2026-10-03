const SAFE_SCHEMES = ['http:', 'https:'];

/** True for an absolute http or https URL. Anything else is unsafe to open or a broken relative link. */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  // The URL parser strips what the browser strips, so the scheme check holds.
  try {
    return SAFE_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
