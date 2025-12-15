import { describe, it, expect } from 'vitest';
import { NewlinesPipe } from './newlines.pipe';

describe('NewlinesPipe', () => {
  it('should create an instance', () => {
    const pipe = new NewlinesPipe();
    expect(pipe).toBeTruthy();
  });

  it('should convert newlines to <br> tags', () => {
    const pipe = new NewlinesPipe();
    const input = 'Line 1\nLine 2\nLine 3';
    const result = pipe.transform(input);
    expect(result).toBe('Line 1<br />Line 2<br />Line 3');
  });

  it('should handle empty strings', () => {
    const pipe = new NewlinesPipe();
    const result = pipe.transform('');
    expect(result).toBe('');
  });

  it('should return empty string when input is null', () => {
    const pipe = new NewlinesPipe();
    const result = pipe.transform(null as any);
    expect(result).toBe('');
  });
});
