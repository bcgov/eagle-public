import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { proponentsQueryOptions } from './org';
import { loadConfig } from 'app/config/config';
import { logger } from 'app/config/logging';
import { native } from 'app/pages/home/home-fetch.spec-helper';

describe('proponentsQueryOptions', () => {
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  const orgs = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: `o${index}`, name: `Org ${index}` }));

  /** Answers `/demi/api/organizations` a page at a time, as DEMI does, with `total` in `x-total-count`. */
  function serveOrgs(rows: unknown[], total = rows.length): void {
    fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url, 'http://host').searchParams;
      const page = Number(params.get('page'));
      const pageSize = Number(params.get('pageSize'));
      return native(rows.slice((page - 1) * pageSize, page * pageSize), total);
    });
    vi.stubGlobal('fetch', fetchMock);
  }

  function requested(n: number): URL {
    return new URL(fetchMock.mock.calls[n][0] as string, 'http://host');
  }

  beforeEach(async () => {
    window.__env = { logLevel: 4 };
    await loadConfig();
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks DEMI native organizations for proponents by name, counted', async () => {
    serveOrgs(orgs(3));

    await proponentsQueryOptions().queryFn();

    const url = requested(0);
    expect(url.pathname).toBe('/demi/api/organizations');
    expect(url.searchParams.getAll('companyType')).toEqual(['Proponent/Certificate Holder']);
    expect(url.searchParams.get('sort')).toBe('name');
    expect(url.searchParams.get('count')).toBe('true');
    expect(url.searchParams.get('pageSize')).toBe('100');
  });

  it('pages until the total count and keeps the native id', async () => {
    serveOrgs(orgs(230));

    const rows = await proponentsQueryOptions().queryFn();

    expect(fetchMock.mock.calls.map((_, n) => requested(n).searchParams.get('page'))).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(rows).toHaveLength(230);
    expect(rows[229].id).toBe('o229');
  });

  it('reads one page when DEMI sends no count', async () => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify(orgs(100))));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await proponentsQueryOptions().queryFn();

    expect(rows).toHaveLength(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops on an empty page and warns when DEMI answered fewer rows than it counted', async () => {
    const warn = vi.spyOn(logger, 'warn');
    serveOrgs(orgs(100), 150);

    const rows = await proponentsQueryOptions().queryFn();

    expect(rows).toHaveLength(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('100 of 150'), 'api');
  });
});
