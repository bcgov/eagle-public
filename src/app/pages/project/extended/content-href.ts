import { hasControlOrSpace, isSitePath } from 'app/utils/safe-url';

/**
 * How a content link opens: `site` for a path on this site, `external` for an `https:` page in a new
 * tab, `same-tab` for `mailto:` and `tel:`. Null for anything else, which content may not link to:
 * a `mailto:` with parameters (`cc`, `bcc`, `body`) or an `https:` URL with a user part.
 */
export type ContentHrefKind = 'site' | 'external' | 'same-tab';

const SCHEME_KINDS: Readonly<Record<string, ContentHrefKind>> = {
  'https:': 'external',
  'mailto:': 'same-tab',
  'tel:': 'same-tab',
};

export function contentHrefKind(href: string): ContentHrefKind | null {
  if (hasControlOrSpace(href)) return null;
  if (href.startsWith('/')) return isSitePath(href) ? 'site' : null;
  try {
    const url = new URL(href);
    // `https://gov.bc.ca@other.example` reads as gov.bc.ca but goes to other.example.
    if (url.username || url.password) return null;
    if (url.protocol === 'mailto:' && url.search) return null;
    return SCHEME_KINDS[url.protocol] ?? null;
  } catch {
    return null;
  }
}

/** True when content may link to `href`: `https:`, `mailto:`, `tel:`, or a path on this site. */
export function isContentHref(href: string): boolean {
  return contentHrefKind(href) !== null;
}
