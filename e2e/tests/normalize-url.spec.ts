import { expect, test } from '@playwright/test';
import { normalizeUrl } from '../support/helpers';

const A = '5c8a3a3ce7f1f1002466c2b1';
const B = '5c8a3a3ce7f1f1002466c2b2';

test('an ids= read records one line whatever the number of ids', () => {
  const one = normalizeUrl(`http://x/demi/api/documents?pageSize=1&ids=${A}`);
  const two = normalizeUrl(`http://x/demi/api/documents?pageSize=2&ids=${A},${B}`);

  expect(one).toBe('/demi/api/documents?ids=:id&pageSize=:n');
  expect(two).toBe(one);
});

test('a full read records its first page and one line for the rest, however many there are', () => {
  const page = (n: number) =>
    normalizeUrl(`http://x/demi/api/organizations?count=true&page=${n}&pageSize=100`);

  expect(page(1)).toBe('/demi/api/organizations?count=true&page=1&pageSize=100');
  expect(page(2)).toBe('/demi/api/organizations?count=true&page=:n&pageSize=100');
  expect(page(14)).toBe(page(2));
});

test('a page size without ids stays as sent', () => {
  expect(normalizeUrl(`http://x/demi/api/documents?pageSize=10&project=${A}`)).toBe(
    '/demi/api/documents?pageSize=10&project=:id',
  );
});
