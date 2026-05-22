/**
 * sanitize-highlight.ts
 *
 * Utilities for rendering Typesense search highlights safely in Angular [innerHTML].
 *
 * Angular's built-in HTML sanitizer allows <mark> tags natively, so output from
 * sanitizeHighlight() can be bound directly via [innerHTML] without bypassSecurityTrustHtml.
 *
 * Pipeline:
 *   Typesense _highlightResult.field.value  →  sanitizeHighlight()  →  [innerHTML]
 *   Raw plain text + query                  →  highlightText()       →  [innerHTML]
 */

/**
 * Strips all HTML tags from a Typesense highlight snippet EXCEPT <mark>…</mark>,
 * and decodes HTML entities in text portions.
 *
 * Why: Typesense returns snippets like:
 *   "brownie <mark>tootsie</mark> roll drag&eacute;e"
 * We want to preserve <mark> for yellow highlighting, decode entities for readability,
 * and strip any dangerous HTML that could appear if index content contains it.
 *
 * Requires escapeHTML: false on connectInfiniteHits — IS.js default (true) would
 * encode <mark> → &lt;mark&gt; before we ever receive it.
 */
export function sanitizeHighlight(html: string): string {
  if (!html) return '';

  // Split on <mark> and </mark> (case-insensitive), capturing the delimiters
  const parts = html.split(/(<\/?mark>)/gi);

  let result = '';
  for (const part of parts) {
    if (/^<mark>$/i.test(part)) {
      result += '<mark>';
    } else if (/^<\/mark>$/i.test(part)) {
      result += '</mark>';
    } else {
      // Text/HTML portion: strip all remaining HTML tags, then decode entities
      const stripped = part.replace(/<[^>]*>/g, '');
      result += decodeHtmlEntities(stripped);
    }
  }

  return result;
}

/**
 * Client-side highlight fallback: HTML-escapes text to prevent XSS, then wraps
 * each search query token in <mark> tags.
 *
 * Use when _highlightResult is absent (e.g., field not in highlight_fields).
 * Output is safe for [innerHTML] — escaping happens before mark injection.
 *
 * @param text  Raw (unescaped) text from the hit document
 * @param query Search query string; tokens split on whitespace
 */
export function highlightText(text: string, query: string): string {
  if (!text) return '';

  const escaped = escapeHtml(text);
  if (!query) return escaped;

  const tokens = query
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => escapeRegex(t));

  if (!tokens.length) return escaped;

  // Wrap matches in <mark>; case-insensitive, global
  const pattern = new RegExp(`(${tokens.join('|')})`, 'gi');
  return escaped.replace(pattern, '<mark>$1</mark>');
}

/**
 * HTML-escapes special characters to prevent XSS.
 * Safe for use in [innerHTML] — browsers render the escaped entities as literal text.
 */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── Internal helpers ────────────────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
    ndash: '\u2013', mdash: '\u2014',
    rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201D', ldquo: '\u201C',
    hellip: '\u2026', bull: '\u2022', middot: '\u00B7',
    copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
    eacute: '\u00E9', Eacute: '\u00C9', aacute: '\u00E1', Aacute: '\u00C1',
    iacute: '\u00ED', Iacute: '\u00CD', oacute: '\u00F3', Oacute: '\u00D3',
    uacute: '\u00FA', Uacute: '\u00DA', agrave: '\u00E0', egrave: '\u00E8',
    ntilde: '\u00F1', Ntilde: '\u00D1', ouml: '\u00F6', Ouml: '\u00D6',
    auml: '\u00E4', Auml: '\u00C4', uuml: '\u00FC', Uuml: '\u00DC',
    ccedil: '\u00E7', Ccedil: '\u00C7', szlig: '\u00DF',
  };
  return text
    .replace(/&([a-zA-Z]+);/g, (_, n) => named[n] ?? named[n.toLowerCase()] ?? `&${n};`)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
