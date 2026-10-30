import { afterEach, describe, expect, it, vi } from 'vitest';
import { skipToken } from '@tanstack/react-query';
import { json } from 'app/pages/home/home-fetch.spec-helper';
import { getSuggestions, suggestQueryOptions } from './suggest';

afterEach(() => vi.unstubAllGlobals());

function answer(body: unknown) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => json(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('getSuggestions', () => {
  it('asks DEMI /suggest for at most 8 rows of the kind and answers its items', async () => {
    const fetchMock = answer({ items: [{ id: 'd1', displayName: 'Coal report' }] });

    const items = await getSuggestions('documents', 'coal');

    const url = new URL(String(fetchMock.mock.calls[0][0]), 'https://site.invalid');
    expect(url.pathname).toBe('/demi/api/suggest');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      kind: 'documents',
      q: 'coal',
      limit: '8',
    });
    expect(items).toEqual([{ id: 'd1', displayName: 'Coal report' }]);
  });

  it('answers no rows when the body carries no items list', async () => {
    answer({});

    expect(await getSuggestions('projects', 'ce')).toEqual([]);
  });

  it('drops rows whose name is not text', async () => {
    answer({ items: [{ id: 'p1', name: 42 }, null, { id: 'p2', name: 'Cedar LNG' }] });

    expect(await getSuggestions('projects', 'ce')).toEqual([{ id: 'p2', name: 'Cedar LNG' }]);
  });

  it('keeps a comment period named only by its project', async () => {
    answer({
      items: [
        { id: 'c1', informationLabel: 'Draft decision' },
        { id: 'c2', projectName: 'Cedar LNG' },
        { id: 'c3', informationLabel: '', projectName: 'Centerm' },
        { id: 'c4' },
      ],
    });

    expect(await getSuggestions('comment-periods', 'ce')).toEqual([
      { id: 'c1', informationLabel: 'Draft decision' },
      { id: 'c2', projectName: 'Cedar LNG' },
      { id: 'c3', informationLabel: '', projectName: 'Centerm' },
    ]);
  });
});

describe('suggestQueryOptions', () => {
  it('asks only for a keyword of two or more characters', () => {
    expect(suggestQueryOptions('comment-periods', 'ce').queryFn).toBeTypeOf('function');
    expect(suggestQueryOptions('projects', ' c ').queryFn).toBe(skipToken);
  });

  it('keys the query by kind and trimmed, lower-cased keyword', () => {
    expect(suggestQueryOptions('updates', ' Cedar ').queryKey).toEqual([
      'suggest',
      'updates',
      'cedar',
    ]);
  });

  it('never retries, so a failed suggestion read shows at once', () => {
    expect(suggestQueryOptions('projects', 'ce').retry).toBe(false);
  });
});
