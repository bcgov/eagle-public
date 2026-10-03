import { describe, it, expect } from 'vitest';
import { documentDownloadUrl, rewriteLegacyDocumentLinks, rewriteLegacyDocumentUrl } from './legacy-document-url';

const ID = '5c8a7b6d5e4f3a2b1c0d9e8f';
const SEARCH = '/demi-search';
const DEMI = `${SEARCH}/documents/${ID}/download?redirect=1&inline=1`;

describe('documentDownloadUrl', () => {
  it('asks for an attachment by default', () => {
    expect(documentDownloadUrl(SEARCH, 'a/b')).toBe(`${SEARCH}/documents/a%2Fb/download?redirect=1`);
  });

  it('asks for inline display when told to', () => {
    expect(documentDownloadUrl(SEARCH, ID, { inline: true })).toBe(DEMI);
  });
});

describe('rewriteLegacyDocumentUrl', () => {
  it.each([
    ['public download with a file name', `/api/public/document/${ID}/download/Report.pdf`],
    ['public download, no file name', `/api/public/document/${ID}/download`],
    ['fetch route', `/api/document/${ID}/fetch`],
    ['download route with a file name', `/api/document/${ID}/download/a%20b.pdf`],
    ['prod host', `https://projects.eao.gov.bc.ca/api/public/document/${ID}/download/x.pdf`],
    ['old pathfinder host', `https://eagle-prod.pathfinder.gov.bc.ca/api/document/${ID}/fetch`],
    ['host with a trailing dot', `https://projects.eao.gov.bc.ca./api/document/${ID}/fetch`],
    ['relative to a nested page', `../api/public/document/${ID}/download`],
    ['upper-case id', `/api/document/${ID.toUpperCase()}/fetch`],
  ])('points a %s at the inline DEMI download', (_label, href) => {
    expect(rewriteLegacyDocumentUrl(href, SEARCH)).toBe(DEMI);
  });

  it.each([
    ['a foreign host', `https://example.com/api/public/document/${ID}/download`],
    ['an id that is not 24 hex', '/api/public/document/abc123/download'],
    ['a 25-character id', `/api/document/${ID}0/fetch`],
    ['a non-file document route', `/api/document/${ID}/delete`],
    ['the public route without download', `/api/public/document/${ID}`],
    ['an ordinary page', 'https://www2.gov.bc.ca/assets/doc.pdf'],
    ['a mailto link', 'mailto:eao@gov.bc.ca'],
    ['an empty string', ''],
    ['a protocol-relative foreign host', `//example.com/api/document/${ID}/fetch`],
    ['a javascript: href naming a legacy host', `javascript://projects.eao.gov.bc.ca/api/document/${ID}/fetch/%0Aalert(1)`],
    ['a data: href naming a legacy host', `data://projects.eao.gov.bc.ca/api/document/${ID}/fetch`],
  ])('leaves %s unchanged', (_label, href) => {
    expect(rewriteLegacyDocumentUrl(href, SEARCH)).toBe(href);
  });

  it('builds the target on the configured search path', () => {
    expect(rewriteLegacyDocumentUrl(`/api/document/${ID}/fetch`, 'https://demi.example/api'))
      .toBe(`https://demi.example/api/documents/${ID}/download?redirect=1&inline=1`);
  });
});

describe('rewriteLegacyDocumentLinks', () => {
  function parse(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
  }

  it('rewrites a legacy link in staff HTML', () => {
    const out = parse(rewriteLegacyDocumentLinks(`<p>See <a href="/api/public/document/${ID}/download/r.pdf">the report</a></p>`, SEARCH));
    expect(out.querySelector('a')?.getAttribute('href')).toBe(DEMI);
  });

  it('rewrites a legacy image source', () => {
    const out = parse(rewriteLegacyDocumentLinks(`<img src="/api/document/${ID}/fetch">`, SEARCH));
    expect(out.querySelector('img')?.getAttribute('src')).toBe(DEMI);
  });

  it('rewrites each legacy srcset candidate and keeps its descriptor', () => {
    const out = parse(rewriteLegacyDocumentLinks(
      `<picture><source srcset="/api/document/${ID}/fetch 2x"><img srcset="/api/document/${ID}/fetch 1x, https://www2.gov.bc.ca/a.png 2x"></picture>`,
      SEARCH,
    ));
    expect(out.querySelector('source')?.getAttribute('srcset')).toBe(`${DEMI} 2x`);
    expect(out.querySelector('img')?.getAttribute('srcset')).toBe(`${DEMI} 1x, https://www2.gov.bc.ca/a.png 2x`);
  });

  it('passes script and event handler markup through as given; the binding sanitizes it', () => {
    const html = '<p>Hi<script>alert(1)</script><img src="x.png" onerror="alert(2)"></p>';
    expect(rewriteLegacyDocumentLinks(html, SEARCH)).toBe(html);
  });

  it('leaves other links alone', () => {
    const out = parse(rewriteLegacyDocumentLinks('<a href="https://www2.gov.bc.ca/">BC</a>', SEARCH));
    expect(out.querySelector('a')?.getAttribute('href')).toBe('https://www2.gov.bc.ca/');
  });

  it('keeps the text around the links', () => {
    const out = parse(rewriteLegacyDocumentLinks(`<p>See <a href="/api/document/${ID}/fetch">this</a> now</p>`, SEARCH));
    expect(out.textContent).toBe('See this now');
  });
});
