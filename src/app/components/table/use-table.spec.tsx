import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from 'app/api/query-client';
import { native } from 'app/pages/home/home-fetch.spec-helper';
import { makeQueryClient } from '../../../test-utils';
import { useTable, type TableQueryConfig } from './use-table';

const CONFIG: TableQueryConfig = { projId: 'notification-1', page: 1, pageSize: 10 };

let fetchMock: ReturnType<typeof vi.fn>;
let client = makeQueryClient();

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderTable(config: TableQueryConfig = CONFIG) {
  return renderHook(() => useTable('docs', config), { wrapper });
}

/** Every request from here on hangs, so the query stays in flight. */
function hangFetch(): void {
  fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
}

beforeEach(() => {
  fetchMock = vi.fn(async (_input: RequestInfo | URL) => native([], 0));
  vi.stubGlobal('fetch', fetchMock);
  client = makeQueryClient();
  // The DEMI project lookup caches here, so each test answers its own.
  queryClient.clear();
});

afterEach(() => vi.unstubAllGlobals());

/** The document read among the calls, past the DEMI project lookup. */
function documentsUrl(): URL {
  const call = fetchMock.mock.calls.find(([input]) =>
    String(input).startsWith('/demi/api/documents'),
  );
  return new URL(String(call?.[0]), 'http://localhost');
}

describe('useTable initialLoading', () => {
  it('is true while the first page is in flight', () => {
    hangFetch();

    const { result } = renderTable();

    expect(result.current.initialLoading).toBe(true);
  });

  it('turns false once the first page lands, with its rows and total', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).startsWith('/demi/api/documents') ? native([{ id: 'doc-1' }], 12) : native([]),
    );
    const { result } = renderTable();

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(result.current.totalListItems).toBe(12);
    expect(result.current.data.map((row) => row._id)).toEqual(['doc-1']);
  });

  it('stays false while a page already on hand refetches', async () => {
    const { result } = renderTable();
    await waitFor(() => expect(result.current.loading).toBe(false));
    hangFetch();

    void client.invalidateQueries();

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.initialLoading).toBe(false);
  });

  it('is false for a query held back by enabled: false', () => {
    const { result } = renderTable({ ...CONFIG, enabled: false });

    expect(result.current.initialLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useTable keywords', () => {
  it('sends a typed plus as a literal plus, not a space', async () => {
    renderTable({ ...CONFIG, keywords: 'a+b' });

    await waitFor(() => expect(documentsUrl().searchParams.get('q')).toBe('a+b'));
  });
});
