import { describe, it, expect } from 'vitest';
import { PublishedPipe } from './published.pipe';

describe('PublishedPipe', () => {
  it('should create an instance', () => {
    const pipe = new PublishedPipe();
    expect(pipe).toBeTruthy();
  });

  it('should filter published items', () => {
    const pipe = new PublishedPipe();
    const input = [
      { _id: '1', isPublished: true },
      { _id: '2', isPublished: false },
      { _id: '3', isPublished: false },
      { _id: '4', isPublished: true }
    ];
    const result = pipe.transform(input);
    expect(result.length).toBe(2);
    expect(result[0]._id).toBe('1');
    expect(result[1]._id).toBe('4');
  });

  it('should handle empty arrays', () => {
    const pipe = new PublishedPipe();
    const result = pipe.transform([]);
    expect(result).toEqual([]);
  });

  it('should handle null values', () => {
    const pipe = new PublishedPipe();
    const result = pipe.transform(null as any);
    expect(result).toBeNull();
  });
});
