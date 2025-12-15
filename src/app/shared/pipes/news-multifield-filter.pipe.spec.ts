import { describe, it, expect } from 'vitest';
import { NewsMultifieldFilterPipe } from './news-multifield-filter.pipe';
import { News } from 'app/models/news';

describe('NewsMultifieldFilterPipe', () => {
  const pipe = new NewsMultifieldFilterPipe();

  const mockNews: News[] = [
    {
      _id: '1',
      project: { name: 'Highland Valley Mine', _id: 'proj1' } as any,
      headline: 'New Environmental Assessment',
      type: 'News',
      dateAdded: new Date(),
      dateUpdated: new Date()
    } as unknown as News,
    {
      _id: '2',
      project: { name: 'Coastal Project', _id: 'proj2' } as any,
      headline: 'Public Consultation Begins',
      type: 'Announcement',
      dateAdded: new Date(),
      dateUpdated: new Date()
    } as unknown as News,
    {
      _id: '3',
      project: null as any,
      headline: 'General Announcement',
      type: 'Announcement',
      dateAdded: new Date(),
      dateUpdated: new Date()
    } as unknown as News
  ];

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return all items when query is empty', () => {
    const result = pipe.transform(mockNews, '');
    expect(result).toEqual(mockNews);
  });

  it('should return all items when query is null', () => {
    const result = pipe.transform(mockNews, null as any);
    expect(result).toEqual(mockNews);
  });

  it('should filter by project name', () => {
    const result = pipe.transform(mockNews, 'Highland');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('1');
  });

  it('should filter by headline', () => {
    const result = pipe.transform(mockNews, 'Consultation');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('2');
  });

  it('should be case insensitive', () => {
    const result = pipe.transform(mockNews, 'COASTAL');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('2');
  });

  it('should match announcement type for items without project/headline match', () => {
    const result = pipe.transform(mockNews, 'announcement');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle items with null project', () => {
    const result = pipe.transform(mockNews, 'General');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('3');
  });

  it('should return empty array when no matches', () => {
    const result = pipe.transform(mockNews, 'NonExistent');
    expect(result).toEqual([]);
  });
});
