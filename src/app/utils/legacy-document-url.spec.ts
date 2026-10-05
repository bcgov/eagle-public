import { describe, it, expect } from 'vitest';
import { rewriteLegacyDocumentUrl } from './legacy-document-url';

const ID = '5c8a3a3ce7f1f1002466c2b1';
const DEMI = `/demi-search/documents/${ID}/download?redirect=1`;
const DEMI_INLINE = `${DEMI}&inline=1`;

describe('rewriteLegacyDocumentUrl', () => {
  // eagle-api served these inline for pdf and images: protectedOpen and publicDownload.
  it.each([
    ['fetch with a name', `/api/document/${ID}/fetch/Report.pdf`],
    ['public download with no name', `/api/public/document/${ID}/download`],
    ['public download with a name', `/api/public/document/${ID}/download/Report.pdf`],
    ['a multi-segment tail', `/api/document/${ID}/fetch/2026/Final%20Report.pdf`],
    ['a relative api/ path', `api/document/${ID}/fetch/Report.pdf`],
    ['a ./api/ path', `./api/document/${ID}/fetch/Report.pdf`],
    ['a ../../api/ path', `../../api/public/document/${ID}/download`],
    ['projects.eao.gov.bc.ca', `https://projects.eao.gov.bc.ca/api/document/${ID}/fetch/a.pdf`],
    [
      'eagle-test on silver',
      `https://eagle-test.apps.silver.devops.gov.bc.ca/api/public/document/${ID}/download`,
    ],
    ['an http: link', `http://projects.eao.gov.bc.ca/api/document/${ID}/fetch/a.pdf`],
    ['a protocol-relative link', `//projects.eao.gov.bc.ca/api/document/${ID}/fetch/a.pdf`],
    ['a query, which eagle-api ignored', `/api/document/${ID}/fetch/a.pdf?inline=0`],
  ])('sends %s to the inline DEMI download', (_, href) => {
    expect(rewriteLegacyDocumentUrl(href)).toBe(DEMI_INLINE);
  });

  // eagle-api sent these as attachments: protectedDownload.
  it.each([
    ['fetch with no name', `/api/document/${ID}/fetch`],
    ['fetch with an empty name', `/api/document/${ID}/fetch/`],
    ['download with no name', `/api/document/${ID}/download`],
    ['download with a name', `/api/document/${ID}/download/Report.pdf`],
    ['a ../api/ path', `../api/document/${ID}/download/Report.pdf`],
    ['www.projects.eao.gov.bc.ca', `https://www.projects.eao.gov.bc.ca/api/document/${ID}/fetch`],
    [
      'eagle-prod on pathfinder',
      `https://eagle-prod.pathfinder.gov.bc.ca/api/document/${ID}/fetch`,
    ],
    [
      'eagle-dev on silver',
      `https://eagle-dev.apps.silver.devops.gov.bc.ca/api/document/${ID}/download`,
    ],
    ['a fully qualified host name', `https://projects.eao.gov.bc.ca./api/document/${ID}/fetch`],
    ['an upper-case host', `HTTPS://PROJECTS.EAO.GOV.BC.CA/api/document/${ID}/fetch`],
    ['surrounding whitespace', `  https://projects.eao.gov.bc.ca/api/document/${ID}/fetch \n`],
  ])('sends %s to the attachment DEMI download', (_, href) => {
    expect(rewriteLegacyDocumentUrl(href)).toBe(DEMI);
  });

  it('keeps the page fragment on an inline link', () => {
    expect(rewriteLegacyDocumentUrl(`/api/document/${ID}/fetch/a.pdf?x=1#page=25`)).toBe(
      `${DEMI_INLINE}#page=25`,
    );
  });

  it('keeps the fragment on an attachment link', () => {
    expect(rewriteLegacyDocumentUrl(`/api/document/${ID}/download#page=3`)).toBe(`${DEMI}#page=3`);
  });

  it('rewrites a link to the page host itself', () => {
    // jsdom's page origin, read from the environment rather than from the code under test.
    const href = `${window.location.origin}/api/document/${ID}/fetch/a.pdf`;

    expect(rewriteLegacyDocumentUrl(href)).toBe(DEMI_INLINE);
  });

  it('lower-cases an upper-case id', () => {
    expect(rewriteLegacyDocumentUrl('/api/document/5C8A3A3CE7F1F1002466C2B1/fetch')).toBe(DEMI);
  });

  it.each([
    ['another host with the same path', `https://example.com/api/document/${ID}/fetch/a.pdf`],
    [
      'a host that only starts like a legacy one',
      `https://projects.eao.gov.bc.ca.example.com/api/document/${ID}/fetch`,
    ],
    ['a backslash host on a site path', `/\\example.com/api/document/${ID}/fetch`],
    ['an ftp: link to a legacy host', `ftp://projects.eao.gov.bc.ca/api/document/${ID}/fetch`],
    ['a non-hex id', '/api/document/d1/fetch/Amendment%20Order.pdf'],
    ['a 23-character id', `/api/document/${ID.slice(1)}/fetch`],
    ['a 25-character id', `/api/document/${ID}0/fetch`],
    ['a document with no action', `/api/document/${ID}`],
    ['a public document with no action', `/api/public/document/${ID}`],
    ['a public fetch, which eagle-api never served', `/api/public/document/${ID}/fetch`],
    ['an action with a suffix', `/api/document/${ID}/fetchall`],
    ['a folder listing', '/api/docs?folder=5c8a3a3ce7f1f1002466c2b1'],
    ['a mailto: link', 'mailto:eao.compliance@gov.bc.ca'],
    ['an in-page hash', '#section-2'],
    ['a javascript: URL', `${'java'}script:fetch('/api/document/${ID}/fetch')`],
    ['a malformed URL', `http://[/api/document/${ID}/fetch`],
    ['an empty string', ''],
    ['an already rewritten DEMI URL', DEMI],
    ['an ordinary relative link', 'reports/Annual%20Report.pdf?x=1&y=2'],
    ['an ordinary site path', '/p/5c8a3a3ce7f1f1002466c2b1/documents'],
  ])('leaves %s byte for byte', (_, href) => {
    expect(rewriteLegacyDocumentUrl(href)).toBe(href);
  });
});
