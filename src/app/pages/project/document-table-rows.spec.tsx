import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { loadConfig } from 'app/config/config';
import { tableObject } from 'app/components/table/table-object';
import { clearSelection, SELECT_ALL_MAX, setSelected } from 'app/state/bulk-download';
import { clearToasts, useToasts } from 'app/state/toast';
import { DocumentTableRow } from './document-table-rows';

const DOCUMENT = {
  _id: 'doc-1',
  displayName: 'Fish Habitat Report',
  documentFileName: 'fish-habitat.pdf',
  datePosted: '2026-05-04T00:00:00.000Z'
};

/**
 * The Name cell is a real link so it can be middle-clicked, copied and opened in a new tab. Its
 * href is the eagle-api URL; a plain click still goes through `openDocumentDownload`.
 */
describe('DocumentTableRow name cell', () => {
  const originalEnv = window.__env;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // No search backend, so the download takes the eagle-api path and `window.open` is observable.
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '' };
    await loadConfig();
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.unstubAllGlobals();
  });

  function renderRow() {
    render(
      <MemoryRouter>
        <table>
          <tbody>
            <DocumentTableRow rowData={DOCUMENT} tableData={tableObject()} columns={[]} onMessage={() => undefined} />
          </tbody>
        </table>
      </MemoryRouter>
    );
    return screen.getByRole('link', { name: 'Fish Habitat Report' });
  }

  it('links to the eagle-api download URL', () => {
    const link = renderRow();
    expect(link).toHaveAttribute('href', '/api/public/document/doc-1/download/fish-habitat.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('starts the download once on click rather than following the href', async () => {
    const link = renderRow();

    await userEvent.click(link);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('/api/public/document/doc-1/download/fish-habitat.pdf', '_blank');
  });

  it('starts the download once when Enter is pressed on the link', async () => {
    // The row also handles Enter. Without the target guard the anchor's own Enter would download
    // twice, which the browser answers with a second tab.
    const link = renderRow();
    link.focus();

    await userEvent.keyboard('{Enter}');

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('still starts the download when Enter is pressed on the row itself', async () => {
    renderRow();
    screen.getByRole('row').focus();

    await userEvent.keyboard('{Enter}');

    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});

/** The checkbox column only exists where bulk download is configured, so it is opt-in per table. */
describe('DocumentTableRow selection', () => {
  const originalEnv = window.__env;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '' };
    await loadConfig();
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    clearSelection();
    clearToasts();
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.unstubAllGlobals();
  });

  function renderRow(selectable: boolean) {
    render(
      <MemoryRouter>
        <table>
          <tbody>
            <DocumentTableRow
              rowData={DOCUMENT}
              tableData={tableObject({ tableId: 'documents', options: { selectable } })}
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

    expect(screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' })).toBeChecked();
    expect(screen.getByRole('row')).toHaveClass('selected');
  });

  it('says so rather than selecting past the 100-document cap', async () => {
    setSelected(
      'documents',
      Array.from({ length: SELECT_ALL_MAX }, (_, i) => ({ id: `other-${i}`, displayName: `Other ${i}` }))
    );
    const toasts = renderHook(() => useToasts());
    renderRow(true);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' }));

    expect(toasts.result.current.map(toast => toast.message)).toEqual([
      'You can select up to 100 documents at a time.'
    ]);
    expect(screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' })).not.toBeChecked();
  });

  it('does not start a download when the checkbox is clicked', async () => {
    renderRow(true);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' }));

    expect(openSpy).not.toHaveBeenCalled();
  });
});
