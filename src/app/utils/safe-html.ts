import DOMPurify from 'dompurify';

/**
 * HTML for dangerouslySetInnerHTML. React strips nothing, where Angular's [innerHTML] ran the
 * DomSanitizer, so scripts and event handlers are removed here. Links keep target/rel.
 */
export function safeHtml(value: string): { __html: string } {
  return { __html: DOMPurify.sanitize(value ?? '', { ADD_ATTR: ['target'] }) };
}

/**
 * Plain text for a plain-text slot: every tag becomes a space, and the parser decodes the entities
 * an editor leaves behind. Sanitizing before the tags go is what keeps a script's body out of the
 * words. The result is text, never markup: a doubly escaped entity stays written out.
 */
export function htmlToText(value: unknown): string {
  const spaced = DOMPurify.sanitize(String(value ?? '')).replace(/<[^>]*>/g, ' ');
  const text = DOMPurify.sanitize(spaced, { ALLOWED_TAGS: [], RETURN_DOM: true }).textContent ?? '';
  return text.replace(/\s+/g, ' ').trim();
}
