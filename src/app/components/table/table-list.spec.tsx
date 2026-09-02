import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { loadConfig } from 'app/config/config';
import { TableList, type TableListConfig } from './table-list';
import type { TableRowProps } from './table-object';

const DOCUMENTS = [{ _id: 'doc-1', displayName: 'Fish Habitat Report' }];

function IdRow({ rowData, tableData }: TableRowProps) {
  return (
    <tr>
      <td>{rowData.displayName}</td>
      <td data-testid="table-id">{tableData.tableId}</td>
    </tr>
  );
}

const CONFIG: TableListConfig = {
  tableId: 'search-documents',
  datasetType: 'Document',
  defaultSort: '-datePosted',
  heroBanner: { title: 'Documents', description: 'Search documents' },
  tableColumns: [{ name: 'Name', value: 'displayName' }],
  tableRowComponent: IdRow,
  filterList: [],
  dateFilterList: [],
  filters: []
};

/**
 * The table id keys per-table state (selection, cache). `tableObject` invents a random UUID when it
 * is not given one, so a table that never passes it gets a new id on every memo recompute.
 */
describe('TableList', () => {
  const originalEnv = window.__env;

  beforeEach(async () => {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '' };
    await loadConfig();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([{ searchResults: DOCUMENTS, meta: [{ searchResultsTotal: DOCUMENTS.length }] }])
      )
    );
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('hands the configured table id to its rows', async () => {
    const router = createMemoryRouter([{ path: '/search', element: <TableList config={CONFIG} /> }], {
      initialEntries: ['/search']
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('table-id')).toHaveTextContent('search-documents');
  });
});
