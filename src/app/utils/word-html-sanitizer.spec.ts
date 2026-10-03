import { describe, it, expect } from 'vitest';
import { sanitizeWordHtml } from './word-html-sanitizer';

describe('sanitizeWordHtml', () => {
  it('returns empty string for null, undefined, and empty string', () => {
    // All falsy values produce '' — safe for innerHTML binding
    expect(sanitizeWordHtml('')).toBe('');
    expect(sanitizeWordHtml(null as any)).toBe('');
    expect(sanitizeWordHtml(undefined as any)).toBe('');
  });

  it('leaves clean HTML unchanged', () => {
    const clean = '<p>Hello world.</p><p>Second paragraph.</p>';
    expect(sanitizeWordHtml(clean)).toBe(clean);
  });

  it('strips inline style attributes (Word Desktop)', () => {
    const input = '<p style="margin-left: 0in;">Hello</p>';
    expect(sanitizeWordHtml(input)).toBe('<p>Hello</p>');
  });

  it('strips MsoNormal and other Word class attributes', () => {
    const input = '<p class="MsoNormal">Hello world.</p>';
    expect(sanitizeWordHtml(input)).toBe('<p>Hello world.</p>');
  });

  it('strips mso-* inline styles from spans', () => {
    const input =
      '<p class="MsoNormal"><span lang="EN-US" style="mso-ansi-language: EN-US;">Hello world.</span></p>';
    // After stripping class, style, lang, and unwrapping bare span:
    expect(sanitizeWordHtml(input)).toBe('<p>Hello world.</p>');
  });

  it('strips inline font-family and font-size (Word Desktop)', () => {
    const input =
      '<p><span style="font-size: 11pt; font-family: \'Calibri Light\', sans-serif;">The EAO has agreed.</span></p>';
    expect(sanitizeWordHtml(input)).toBe('<p>The EAO has agreed.</p>');
  });

  it('strips color: windowtext', () => {
    const input = '<p><span style="color: windowtext;">Transfer complete.</span></p>';
    expect(sanitizeWordHtml(input)).toBe('<p>Transfer complete.</p>');
  });

  it('strips background-color from OutlineElement (Word Online)', () => {
    const input =
      '<div class="OutlineElement Ltr SCXW233636762 BCX0" style="background-color: #ffffff; font-size: 12px;">' +
      '<p class="Paragraph SCXW233636762 BCX0" style="margin: 0px 0px 10.6667px;">' +
      '<span class="TextRun SCXW233636762 BCX0" style="font-family: Aptos; font-size: 11pt;">' +
      '<span class="NormalTextRun SCXW233636762 BCX0" style="margin: 0px;">Certificate granted.</span>' +
      '</span></p></div>';
    expect(sanitizeWordHtml(input)).toBe('<p>Certificate granted.</p>');
  });

  it('strips lang and xml:lang attributes', () => {
    const input = '<p><span lang="EN-CA" xml:lang="EN-CA">Hello.</span></p>';
    expect(sanitizeWordHtml(input)).toBe('<p>Hello.</p>');
  });

  it('strips data-* attributes (Word Online)', () => {
    const input = '<p><span data-contrast="auto" data-ccp-paras="1">Hello.</span></p>';
    expect(sanitizeWordHtml(input)).toBe('<p>Hello.</p>');
  });

  it('preserves href on anchor tags', () => {
    const input =
      '<p class="MsoNormal"><span style="mso-ansi-language: EN-US;">See <a href="https://example.gov.bc.ca">this record</a>.</span></p>';
    expect(sanitizeWordHtml(input)).toBe(
      '<p>See <a href="https://example.gov.bc.ca">this record</a>.</p>',
    );
  });

  it('preserves target and rel on anchor tags', () => {
    const input = '<p><a href="https://example.com" target="_blank" rel="noopener">Link</a></p>';
    expect(sanitizeWordHtml(input)).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener">Link</a></p>',
    );
  });

  it('preserves strong and em tags', () => {
    const input = '<p class="MsoNormal"><strong>Important:</strong> <em>Note this.</em></p>';
    expect(sanitizeWordHtml(input)).toBe('<p><strong>Important:</strong> <em>Note this.</em></p>');
  });

  it('preserves ul/ol/li lists', () => {
    const input =
      '<ul><li class="MsoNormal" style="margin-left: 0in;">Item one</li><li class="MsoNormal">Item two</li></ul>';
    expect(sanitizeWordHtml(input)).toBe('<ul><li>Item one</li><li>Item two</li></ul>');
  });

  it('removes empty p tags', () => {
    const input = '<p>Hello.</p><p></p><p>World.</p>';
    expect(sanitizeWordHtml(input)).toBe('<p>Hello.</p><p>World.</p>');
  });

  it('removes p tags containing only &nbsp;', () => {
    const input = '<p>First.</p><p>&nbsp;</p><p>Second.</p>';
    expect(sanitizeWordHtml(input)).toBe('<p>First.</p><p>Second.</p>');
  });

  it('handles deeply nested Word Online structure (real-world test)', () => {
    // Simplified version of the Fraser River Tunnel activity pattern
    const input =
      '<div class="OutlineElement Ltr SCXW233636762 BCX0" style="-webkit-user-drag: none; font-family: \'Segoe UI\'; font-size: 12px; background-color: #ffffff;">' +
      '<p class="Paragraph SCXW233636762 BCX0" style="margin: 0px 0px 10.6667px; user-select: text;">' +
      '<span class="TextRun SCXW233636762 BCX0" style="font-family: Aptos; font-size: 11pt; line-height: 18px;">' +
      '<span class="NormalTextRun SCXW233636762 BCX0" style="margin: 0px; padding: 0px;">A certificate has been </span>' +
      '<span class="NormalTextRun SCXW233636762 BCX0" style="margin: 0px; padding: 0px;">issued.</span>' +
      '</span></p></div>';
    expect(sanitizeWordHtml(input)).toBe('<p>A certificate has been issued.</p>');
  });

  it('handles mixed clean and Word-pasted paragraphs', () => {
    const input =
      '<p>Clean paragraph one.</p>' +
      '<p class="MsoNormal" style="margin-left: 0in;"><span style="mso-ansi-language: EN-US;">Word paragraph.</span></p>' +
      '<p>Clean paragraph two.</p>';
    // Stripping class/style/lang and unwrapping bare spans produces clean paragraphs
    expect(sanitizeWordHtml(input)).toBe(
      '<p>Clean paragraph one.</p><p>Word paragraph.</p><p>Clean paragraph two.</p>',
    );
  });
});
