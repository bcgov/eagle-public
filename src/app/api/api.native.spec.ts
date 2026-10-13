import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiError, byIdsNative, getNative, listNative } from './api';
import { loadConfig } from 'app/config/config';

/**
 * DEMI's native kind routes answer a plain array, with the total in `x-total-count` and errors as
 * `{error}`. A parameter spelt the old envelope way gets a 400 there, so these pin the URL each
 * helper sends and what it reads back.
 */
describe('DEMI native reads', () => {
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  /** Answers every request with `answer(url)`. */
  function respond(answer: (url: URL) => Response): void {
    fetchMock = vi.fn(async (url: string) => answer(new URL(url, 'http://app.test')));
    vi.stubGlobal('fetch', fetchMock);
  }

  function json(body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status: 200, headers });
  }

  function requested(n = 0): URL {
    return new URL(fetchMock.mock.calls[n][0] as string, 'http://app.test');
  }

  async function configure(env: Record<string, unknown> = {}): Promise<void> {
    window.__env = { logLevel: 4, ...env };
    await loadConfig();
  }

  beforeEach(async () => {
    await configure();
    respond(() => json([]));
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('listNative', () => {
    it('reads the rows and the total DEMI counted into x-total-count', async () => {
      respond(() => json([{ id: 'cp1' }, { id: 'cp2' }], { 'x-total-count': '37' }));

      const page = await listNative<{ id: string }>('commentperiods', { count: true });

      expect(page.rows.map((row) => row.id)).toEqual(['cp1', 'cp2']);
      expect(page.total).toBe(37);
    });

    it('leaves the total unset when DEMI sends no x-total-count', async () => {
      respond(() => json([{ id: 'cp1' }]));

      const page = await listNative('commentperiods');

      expect(page.total).toBeUndefined();
    });

    it('asks /demi/api/<kind> when DEMI_API_PATH is unset', async () => {
      await listNative('lists');

      expect(requested().pathname).toBe('/demi/api/lists');
    });

    it('asks under the configured DEMI_API_PATH', async () => {
      await configure({ DEMI_API_PATH: '/elsewhere/api/' });

      await listNative('lists');

      expect(requested().pathname).toBe('/elsewhere/api/lists');
    });

    it('sends paging, count, one descending sort key and the keyword as DEMI spells them', async () => {
      await listNative('organizations', {
        page: 2,
        pageSize: 25,
        count: true,
        sort: '-name',
        q: 'coal mine',
      });

      const params = requested().searchParams;
      expect(params.get('page')).toBe('2');
      expect(params.get('pageSize')).toBe('25');
      expect(params.get('count')).toBe('true');
      expect(params.get('sort')).toBe('-name');
      expect(params.get('q')).toBe('coal mine');
    });

    it('sends a scalar filter once and an array filter as one repeated parameter per value', async () => {
      await listNative('commentperiods', {
        filters: { project: 'p1', status: ['open', 'closed'], legislation: undefined },
      });

      const params = requested().searchParams;
      expect(params.getAll('project')).toEqual(['p1']);
      expect(params.getAll('status')).toEqual(['open', 'closed']);
      expect(params.has('legislation')).toBe(false);
    });

    it('sends no envelope-era parameters', async () => {
      await listNative('organizations', { page: 1, sort: 'name', filters: { companyType: 'x' } });

      const keys = [...requested().searchParams.keys()];
      expect(keys).toEqual(['page', 'sort', 'companyType']);
    });

    it('answers an empty list filter with no rows and no request, rather than every row', async () => {
      const page = await listNative('commentperiods', { count: true, filters: { status: [] } });

      expect(page).toEqual({ rows: [], total: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws an ApiError carrying DEMI's error text", async () => {
      respond(
        () =>
          new Response(JSON.stringify({ error: 'unknown parameter: sortBy' }), {
            status: 400,
            statusText: 'Bad Request',
          }),
      );

      const failure = await listNative('lists').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApiError);
      expect((failure as ApiError).status).toBe(400);
      expect((failure as ApiError).detail).toBe('unknown parameter: sortBy');
      expect((failure as ApiError).message).toBe('400 - unknown parameter: sortBy');
    });

    it('falls back to the status text when the error body is not JSON', async () => {
      respond(
        () => new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
      );

      const failure = await listNative('lists').catch((error: unknown) => error);

      expect((failure as ApiError).status).toBe(502);
      expect((failure as ApiError).message).toBe('502 - Bad Gateway');
    });
  });

  describe('getNative', () => {
    it('asks for one row by id under the native base', async () => {
      respond(() => json({ id: 'n1', name: 'Notice' }));

      const row = await getNative<{ name: string }>('notifications', 'n1');

      expect(requested().pathname).toBe('/demi/api/notifications/n1');
      expect(row.name).toBe('Notice');
    });

    it('throws ApiError 404 for a row DEMI does not hold', async () => {
      respond(() => new Response(JSON.stringify({ error: 'not found' }), { status: 404 }));

      const failure = await getNative('notifications', 'gone').catch((error: unknown) => error);

      expect((failure as ApiError).status).toBe(404);
      expect((failure as ApiError).detail).toBe('not found');
    });
  });

  describe('byIdsNative', () => {
    const ids = Array.from({ length: 250 }, (_, i) => `d${i}`);

    beforeEach(() => {
      // Echo each batch's ids back as rows, reversed, so only the client can restore the order.
      respond((url) =>
        json(
          (url.searchParams.get('ids') ?? '')
            .split(',')
            .map((id) => ({ id }))
            .reverse(),
        ),
      );
    });

    it('asks for at most 100 ids per request', async () => {
      await byIdsNative('documents', ids);

      const batchSizes = fetchMock.mock.calls.map(
        (_, n) => requested(n).searchParams.get('ids')!.split(',').length,
      );
      expect(batchSizes).toEqual([100, 100, 50]);
    });

    it('asks for a page as large as each batch, so no row falls off a default page', async () => {
      await byIdsNative('documents', ids);

      expect(requested(2).searchParams.get('pageSize')).toBe('50');
    });

    it('returns every row, in the order the ids were given', async () => {
      const found = await byIdsNative<{ id: string }>('documents', ids);

      expect(found.map((row) => row.id)).toEqual(ids);
    });

    it('makes no request for no ids', async () => {
      const found = await byIdsNative('documents', []);

      expect(found).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
