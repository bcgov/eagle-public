import { describe, it, expect } from 'vitest';
import { ObjectFilterPipe } from './object-filter.pipe';

describe('ObjectFilterPipe', () => {
  const pipe = new ObjectFilterPipe();

  const mockObjects = [
    { name: 'Alpha Project', id: 1 },
    { name: 'Beta Initiative', id: 2 },
    { name: 'Gamma Study', id: 3 },
    { name: 'Delta Research', id: 4 }
  ];

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return all items when query is empty', () => {
    const result = pipe.transform(mockObjects, '');
    expect(result).toEqual(mockObjects);
  });

  it('should return all items when query is null', () => {
    const result = pipe.transform(mockObjects, null as any);
    expect(result).toEqual(mockObjects);
  });

  it('should filter by name', () => {
    const result = pipe.transform(mockObjects, 'Alpha');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Project');
  });

  it('should be case insensitive', () => {
    const result = pipe.transform(mockObjects, 'beta');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Beta Initiative');
  });

  it('should support partial matches', () => {
    const result = pipe.transform(mockObjects, 'search');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Delta Research');
  });

  it('should match multiple items', () => {
    const result = pipe.transform(mockObjects, 'a');
    expect(result.length).toBeGreaterThan(1);
  });

  it('should return empty array when no matches', () => {
    const result = pipe.transform(mockObjects, 'xyz');
    expect(result).toEqual([]);
  });

  it('should handle objects with uppercase names', () => {
    const upperObjects = [{ name: 'UPPERCASE NAME' }];
    const result = pipe.transform(upperObjects, 'uppercase');
    expect(result).toHaveLength(1);
  });
});
