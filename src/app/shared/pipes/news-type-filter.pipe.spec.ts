import { describe, it, expect } from 'vitest';
import { NewsTypeFilterPipe } from './news-type-filter.pipe';
import { News } from 'app/models/news';

describe('NewsTypeFilterPipe', () => {
  const pipe = new NewsTypeFilterPipe();

  const mockNews: News[] = [
    {
      _id: '1',
      type: 'News',
      headline: 'Breaking News',
      dateAdded: new Date(),
      dateUpdated: new Date()
    } as unknown as News,
    {
      _id: '2',
      type: 'Announcement',
      headline: 'Important Announcement',
      dateAdded: new Date(),
      dateUpdated: new Date()
    } as unknown as News,
    {
      _id: '3',
      type: 'Update',
      headline: 'Status Update',
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

  it('should filter by type News', () => {
    const result = pipe.transform(mockNews, 'News');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('News');
  });

  it('should filter by type Announcement', () => {
    const result = pipe.transform(mockNews, 'Announcement');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Announcement');
  });

  it('should be case insensitive', () => {
    const result = pipe.transform(mockNews, 'UPDATE');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Update');
  });

  it('should support partial matches', () => {
    const result = pipe.transform(mockNews, 'nounce');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Announcement');
  });

  it('should return empty array when no matches', () => {
    const result = pipe.transform(mockNews, 'NonExistent');
    expect(result).toEqual([]);
  });
});
