import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { emptySearchEnvelope, makeQueryClient } from '../../../test-utils';
import { useTable, type TableQueryConfig } from './use-table';

const CONFIG: TableQueryConfig = { dataset: 'Document', currentPage: 1, pageSize: 10, sortBy: '' };

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
  fetchMock = vi.fn(async (_input: RequestInfo | URL) => emptySearchEnvelope());
  vi.stubGlobal('fetch', fetchMock);
  client = makeQueryClient();
});

afterEach(() => vi.unstubAllGlobals());

describe('useTable initialLoading', () => {
  it('is true while the first page is in flight', () => {
    hangFetch();

    const { result } = renderTable();

    expect(result.current.initialLoading).toBe(true);
  });

  it('turns false once the first page lands', async () => {
    const { result } = renderTable();

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(result.current.totalListItems).toBe(0);
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    expect(url.searchParams.get('keywords')).toBe('a+b');
  });
});
