import DOMPurify from 'dompurify';
import { rewriteLegacyDocumentUrl } from './legacy-document-url';

/** Link and image attributes passed through rewriteLegacyDocumentUrl. */
const URL_ATTRIBUTES = [
  ['a[href]', 'href'],
  ['area[href]', 'href'],
  ['img[src]', 'src'],
] as const;

/**
 * HTML for dangerouslySetInnerHTML. React strips nothing, where Angular's [innerHTML] ran the
 * DomSanitizer, so scripts and event handlers are removed here. Links keep target/rel; a link or
 * image pointing at an old eagle-api document route points at the DEMI download instead.
 */
export function safeHtml(value: string): { __html: string } {
  const dom = DOMPurify.sanitize(value ?? '', {
    ADD_ATTR: ['target'],
    RETURN_DOM_FRAGMENT: true,
  });
  for (const [selector, attribute] of URL_ATTRIBUTES) {
    for (const element of dom.querySelectorAll(selector)) {
      element.setAttribute(
        attribute,
        rewriteLegacyDocumentUrl(element.getAttribute(attribute) ?? ''),
      );
    }
  }
  // The fragment's own document is inert, so an image is not fetched before React mounts it.
  const holder = dom.ownerDocument.createElement('div');
  holder.append(dom);
  return { __html: holder.innerHTML };
}

/** Elements a reader sees a break around, so their words must not run into the next block's. */
const BREAKS_LINE =
  'address,article,aside,blockquote,br,dd,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
  'h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,td,th,tr,ul';

/**
 * Plain text for a plain-text slot: the sanitized DOM is read for its words, with a space where a
 * block or a break separates them, and the parser decodes the entities an editor leaves behind.
 * Sanitizing first is what keeps a script's body out of the words. The result is text, never
 * markup: a doubly escaped entity stays written out.
 */
export function htmlToText(value: unknown): string {
  const dom = DOMPurify.sanitize(String(value ?? ''), { RETURN_DOM_FRAGMENT: true });
  for (const element of dom.querySelectorAll(BREAKS_LINE)) {
    element.before(document.createTextNode(' '));
    element.after(document.createTextNode(' '));
  }
  return (dom.textContent ?? '').replace(/\s+/g, ' ').trim();
}
