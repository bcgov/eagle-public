import { describe, it, expect } from 'vitest';
import { newlines } from './newlines';

describe('newlines', () => {
  it('should convert newlines to <br> tags', () => {
    expect(newlines('Line 1\nLine 2\nLine 3')).toBe('Line 1<br />Line 2<br />Line 3');
  });

  it('should handle empty strings', () => {
    expect(newlines('')).toBe('');
  });

  it('should return empty string when input is null', () => {
    expect(newlines(null as any)).toBe('');
  });
});
