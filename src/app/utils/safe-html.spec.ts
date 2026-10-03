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

describe('safeHtml old eagle-api document links', () => {
  const ID = '5c8a3a3ce7f1f1002466c2b1';
  const LEGACY = `https://projects.eao.gov.bc.ca/api/document/${ID}/fetch/Report.pdf`;
  const DEMI = `/demi-search/documents/${ID}/download?redirect=1`;

  /** Reads one attribute back out of the HTML safeHtml returns. */
  function attributeOf(html: string, selector: string, attribute: string): string | null {
    const template = document.createElement('template');
    template.innerHTML = safeHtml(html).__html;
    return template.content.querySelector(selector)?.getAttribute(attribute) ?? null;
  }

  it.each([
    ['a link', `<a href="${LEGACY}">Report</a>`, 'a', 'href'],
    [
      'an image map area',
      `<map name="m"><area href="${LEGACY}" alt="Report"></map>`,
      'area',
      'href',
    ],
    ['an image', `<img src="${LEGACY}" alt="Map">`, 'img', 'src'],
  ])('points %s at the DEMI download', (_, html, selector, attribute) => {
    expect(attributeOf(html, selector, attribute)).toBe(DEMI);
  });

  it('leaves an ordinary relative link and image as written, target and all', () => {
    const html =
      '<p><a href="../docs/Annual%20Report.pdf?x=1&amp;y=2" target="_blank">Report</a>' +
      '<img src="images/site-map.png" alt="Map"></p>';

    expect(safeHtml(html).__html).toBe(html);
  });

  it('keeps the target of a rewritten link', () => {
    expect(safeHtml(`<a href="${LEGACY}" target="_blank">Report</a>`).__html).toBe(
      `<a href="${DEMI}" target="_blank">Report</a>`,
    );
  });

  it('still drops a javascript: link that names a document route', () => {
    const html = `<a href="${'java'}script:open('/api/document/${ID}/fetch')">Report</a>`;

    expect(safeHtml(html).__html).toBe('<a>Report</a>');
  });

  it('leaves an empty link as written', () => {
    const html = '<a href="">Report</a>';

    expect(safeHtml(html).__html).toBe(html);
  });

  it('keeps srcset, background and poster as written', () => {
    expect(attributeOf(`<img src="map.png" srcset="${LEGACY} 2x">`, 'img', 'srcset')).toBe(
      `${LEGACY} 2x`,
    );
    expect(attributeOf(`<table background="${LEGACY}"></table>`, 'table', 'background')).toBe(
      LEGACY,
    );
    expect(attributeOf(`<video poster="${LEGACY}"></video>`, 'video', 'poster')).toBe(LEGACY);
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

  it('leaves a phrase an inline link interrupts unbroken', () => {
    expect(htmlToText('<p>the <a href="/x">Yellowhead Copper Project</a>, a mine</p>')).toBe(
      'the Yellowhead Copper Project, a mine',
    );
  });

  it('keeps an angle bracket inside an attribute out of the words', () => {
    expect(htmlToText('<a title="a>b">x</a>')).toBe('x');
  });

  it('reads a missing value as nothing', () => {
    expect(htmlToText(undefined)).toBe('');
  });
});
