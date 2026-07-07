/**
 * Sanitizes HTML content that was pasted from Microsoft Word or Word Online
 * into the TinyMCE editor in eagle-admin.
 *
 * Word Desktop injects:
 *   - class="MsoNormal" on <p> tags
 *   - mso-* CSS properties and inline font-family/font-size/color styles on <span> tags
 *
 * Word Online injects:
 *   - Deeply nested <div class="OutlineElement SCXW..."> wrappers
 *   - <p class="Paragraph SCXW..."> with inline margins and background-color
 *   - <span class="TextRun/NormalTextRun SCXW..."> wrapping every word
 *   - Massive inline styles: -webkit-user-drag, user-select, font-family: 'Segoe UI'/Aptos, etc.
 *
 * This function strips all of that noise while preserving semantic content:
 *   <p>, <a>, <strong>, <em>, <b>, <i>, <ul>, <ol>, <li>, <br>
 */
export function sanitizeWordHtml(html: string): string {
  if (!html) return '';
  

  let clean = html;

  // 1. Remove all inline style attributes
  clean = clean.replace(/ style="[^"]*"/gi, '');
  clean = clean.replace(/ style='[^']*'/gi, '');

  // 2. Remove all class attributes (Word / Word Online class noise)
  clean = clean.replace(/ class="[^"]*"/gi, '');
  clean = clean.replace(/ class='[^']*'/gi, '');

  // 3. Remove lang / xml:lang attributes (Word language annotations)
  clean = clean.replace(/ (lang|xml:lang)="[^"]*"/gi, '');

  // 4. Remove data-* attributes (Word Online data-contrast etc.)
  clean = clean.replace(/ data-[a-z][a-z0-9-]*="[^"]*"/gi, '');

  // 5. Remove margin-left / margin-bottom from <p> tags that Word injects
  //    (already handled by step 1, but keeping for clarity)

  // 6. Unwrap bare <div> and <span> tags (no remaining attributes)
  //    These are Word Online's OutlineElement/TextRun/NormalTextRun wrappers
  //    Do this repeatedly until no more bare wrappers remain
  let prev = '';
  while (prev !== clean) {
    prev = clean;
    clean = clean.replace(/<(div|span)\s*>/gi, '');
    clean = clean.replace(/<\/(div|span)>/gi, '');
  }

  // 7. Collapse sequences of whitespace that may result from unwrapping
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.replace(/[ \t]{2,}/g, ' ');

  // 8. Remove empty <p> tags left behind (Word often adds extra blank paragraphs)
  clean = clean.replace(/<p>(\s|&nbsp;)*<\/p>/gi, '');

  return clean.trim();
}
