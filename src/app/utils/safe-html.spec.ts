import { describe, it, expect } from 'vitest';
import { htmlToText, safeHtml } from './safe-html';

describe('safeHtml', () => {
  it('drops event handlers and scripts', () => {
    const { __html } = safeHtml(
      '<p>x</p><img src=x onerror="window.__pwned = true"><script>1</script>',
    );
    expect(__html).toBe('<p>x</p><img src="x">');
  });

  it('drops javascript: links', () => {
    expect(safeHtml('<a href="javascript:alert(1)">a</a>').__html).toBe('<a>a</a>');
  });

  it('keeps ordinary markup and link targets', () => {
    const html = '<p>Hello <b>world</b> <a href="https://x.gov.bc.ca" target="_blank">link</a></p>';
    expect(safeHtml(html).__html).toBe(html);
  });

  it('renders nothing for a missing value', () => {
    expect(safeHtml(undefined as unknown as string).__html).toBe('');
  });
});

describe('htmlToText', () => {
  it('reads stored HTML as words', () => {
    expect(htmlToText('<p>Comment period <b>opens</b>&nbsp;13 March.</p>')).toBe(
      'Comment period opens 13 March.',
    );
  });

  it('keeps the words of one block apart from the next', () => {
    expect(htmlToText('<p>First.</p><p>Second.</p>')).toBe('First. Second.');
  });

  it('decodes named entities', () => {
    expect(htmlToText('EAO&rsquo;s decision')).toBe('EAO’s decision');
    expect(htmlToText('Fish &amp; wildlife &quot;values&quot;')).toBe('Fish & wildlife "values"');
  });

  it('decodes a non-breaking space to an ordinary one', () => {
    expect(htmlToText('EAO&nbsp;decision')).toBe('EAO decision');
  });

  it('decodes decimal and hex numeric entities', () => {
    expect(htmlToText('EAO&#8217;s decision')).toBe('EAO’s decision');
    expect(htmlToText('EAO&#x2019;s decision')).toBe('EAO’s decision');
  });

  it('decodes once, so an escaped entity stays text', () => {
    expect(htmlToText('&amp;lt;')).toBe('&lt;');
  });

  it('drops a script with its body and adds nothing to the page', () => {
    const before = document.querySelectorAll('script').length;
    expect(htmlToText('<script>window.__pwned = true</script>Body')).toBe('Body');
    expect(document.querySelectorAll('script').length).toBe(before);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('reads a missing value as nothing', () => {
    expect(htmlToText(undefined)).toBe('');
  });
});
