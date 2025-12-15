import { describe, it, expect } from 'vitest';
import { OrderByPipe } from './order-by.pipe';

describe('OrderByPipe', () => {
  it('should create an instance', () => {
    const pipe = new OrderByPipe();
    expect(pipe).toBeTruthy();
  });

  it('should sort array of objects by property ascending', () => {
    const pipe = new OrderByPipe();
    const input = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 }
    ];
    const result = pipe.transform(input, { property: 'name', direction: 1 });
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
    expect(result[2].name).toBe('Charlie');
  });

  it('should sort array of objects by property descending', () => {
    const pipe = new OrderByPipe();
    const input = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 }
    ];
    const result = pipe.transform(input, { property: 'age', direction: -1 });
    expect(result[0].age).toBe(35);
    expect(result[1].age).toBe(30);
    expect(result[2].age).toBe(25);
  });

  it('should handle empty arrays', () => {
    const pipe = new OrderByPipe();
    const result = pipe.transform([], 'name');
    expect(result).toEqual([]);
  });

  it('should return array when args are missing', () => {
    const pipe = new OrderByPipe();
    const input = [{ name: 'Test' }];
    expect(pipe.transform(input, {} as any)).toEqual(input);
    expect(pipe.transform(input, { property: 'name' } as any)).toEqual(input);
  });
});
