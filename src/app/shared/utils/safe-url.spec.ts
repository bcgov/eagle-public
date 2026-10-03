import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './safe-url';

describe('isSafeUrl', () => {
  it.each([
    'http://example.gov.bc.ca/x',
    'https://example.gov.bc.ca/x',
    'HTTPS://example.gov.bc.ca/x',
    // Stored links can end in a space; the browser drops it.
    'https://example.gov.bc.ca/x ',
  ])('accepts %s', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,x',
    'vbscript:msgbox(1)',
    'mailto:someone@gov.bc.ca',
    '//evil.example',
    'engage.eao.gov.bc.ca/site-c',
    '/p/123',
    '',
  ])('rejects %s', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(42)).toBe(false);
    expect(isSafeUrl({ toString: () => 'https://example.gov.bc.ca' })).toBe(false);
  });
});
