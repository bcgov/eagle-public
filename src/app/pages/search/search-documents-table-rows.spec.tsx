import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { loadConfig } from 'app/config/config';
import { tableObject } from 'app/components/table/table-object';
import { clearSelection, selectedCount } from 'app/state/bulk-download';
import { DocSearchTableRow } from './search-documents-table-rows';

const DOCUMENT = {
  _id: 'doc-1',
  displayName: 'Fish Habitat Report',
  documentFileName: 'fish-habitat.pdf',
  datePosted: '2026-05-04T00:00:00.000Z',
  project: { _id: 'proj-1', name: 'Alpha Mine' }
};

/** The Name cell is a real link here too, alongside the existing download icon. */
describe('DocSearchTableRow name cell', () => {
  const originalEnv = window.__env;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '' };
    await loadConfig();
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    render(
      <MemoryRouter>
        <table>
          <tbody>
            <DocSearchTableRow rowData={DOCUMENT} tableData={tableObject()} columns={[]} onMessage={() => undefined} />
          </tbody>
        </table>
      </MemoryRouter>
    );
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('links to the eagle-api download URL', () => {
    expect(screen.getByRole('link', { name: 'Fish Habitat Report' })).toHaveAttribute(
      'href',
      '/api/public/document/doc-1/download/fish-habitat.pdf'
    );
  });

  it('starts the download on click rather than following the href', async () => {
    await userEvent.click(screen.getByRole('link', { name: 'Fish Habitat Report' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('/api/public/document/doc-1/download/fish-habitat.pdf', '_blank');
  });

  it('keeps the download icon working', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Download document button' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});

/** Search rows carry the same checkbox column, keyed on the search table's own selection. */
describe('DocSearchTableRow selection', () => {
  const originalEnv = window.__env;

  beforeEach(async () => {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '' };
    await loadConfig();
    clearSelection();
  });

  afterEach(() => {
    window.__env = originalEnv;
  });

  function renderRow(selectable: boolean) {
    render(
      <MemoryRouter>
        <table>
          <tbody>
            <DocSearchTableRow
              rowData={DOCUMENT}
              tableData={tableObject({ tableId: 'search', options: { selectable } })}
              columns={[]}
              onMessage={() => undefined}
            />
          </tbody>
        </table>
      </MemoryRouter>
    );
  }

  it('renders no checkbox while the table is not selectable', () => {
    renderRow(false);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('selects the document from its checkbox and marks the row', async () => {
    renderRow(true);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' }));

    expect(selectedCount('search')).toBe(1);
    expect(screen.getByRole('row')).toHaveClass('selected');
  });
});
