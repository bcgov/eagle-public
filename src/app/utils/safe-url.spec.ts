import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSafeUrl, openExternal } from './safe-url';

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

describe('openExternal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a safe URL in a new tab without handing over the opener', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openExternal('https://example.gov.bc.ca/engagement');
    expect(open).toHaveBeenCalledWith(
      'https://example.gov.bc.ca/engagement',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens nothing for an unsafe URL', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openExternal('javascript:alert(1)');
    expect(open).not.toHaveBeenCalled();
  });
});
