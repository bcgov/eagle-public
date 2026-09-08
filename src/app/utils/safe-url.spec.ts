import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './safe-url';

describe('isSafeUrl', () => {
  it.each([
    'http://example.gov.bc.ca/x',
    'https://example.gov.bc.ca/x',
    'mailto:someone@gov.bc.ca',
    '/p/123',
  ])('accepts %s', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,x',
    'vbscript:msgbox(1)',
    '//evil.example',
    '/\\evil.example',
    '',
  ])('rejects %s', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl({ toString: () => 'https://example.gov.bc.ca' })).toBe(false);
  });
});
