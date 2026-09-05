import DOMPurify from 'dompurify';

/**
 * HTML for dangerouslySetInnerHTML. React strips nothing, where Angular's [innerHTML] ran the
 * DomSanitizer, so scripts and event handlers are removed here. Links keep target/rel.
 */
export function safeHtml(value: string): { __html: string } {
  return { __html: DOMPurify.sanitize(value ?? '', { ADD_ATTR: ['target'] }) };
}

/** Plain text for a plain-text slot: same sanitizer, but drops every tag instead of keeping safe ones. */
export function htmlToText(value: string): string {
  return DOMPurify.sanitize(value ?? '', { ALLOWED_TAGS: [] }).trim();
}
