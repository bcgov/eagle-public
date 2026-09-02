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

const DOWNLOAD_URL = '/api/public/document/doc-1/download/fish-habitat.pdf';

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
    expect(link).toHaveAttribute('href', DOWNLOAD_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('starts the download once on click rather than following the href', async () => {
    const link = renderRow();

    await userEvent.click(link);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(DOWNLOAD_URL, '_blank');
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

/**
 * One model for the whole row: the body selects, the Name link downloads. Nothing else in the row
 * starts a transfer, which is what the Angular table did on every cell.
 */
describe('DocumentTableRow row interaction', () => {
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

  function renderRow(selectable = true) {
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

  const checkbox = () => screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' });

  it('selects the document when a metadata cell is clicked, and downloads nothing', async () => {
    renderRow();

    await userEvent.click(screen.getByText('May 4, 2026'));

    expect(checkbox()).toBeChecked();
    expect(screen.getByRole('row')).toHaveClass('selected');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('deselects the document when the row is clicked again', async () => {
    renderRow();

    await userEvent.click(screen.getByText('May 4, 2026'));
    await userEvent.click(screen.getByText('May 4, 2026'));

    expect(checkbox()).not.toBeChecked();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('leaves the featured star cell as a label, not a download', async () => {
    render(
      <MemoryRouter>
        <table>
          <tbody>
            <DocumentTableRow
              rowData={{ ...DOCUMENT, isFeatured: true }}
              tableData={tableObject({ tableId: 'documents', data: { showFeatured: true } })}
              columns={[]}
              onMessage={() => undefined}
            />
          </tbody>
        </table>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByText('star'));

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('downloads from the name link without selecting the row', async () => {
    renderRow();

    await userEvent.click(screen.getByRole('link', { name: 'Fish Habitat Report' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(DOWNLOAD_URL, '_blank');
    expect(checkbox()).not.toBeChecked();
  });

  it('renders no download button; the name link is the only per-row download', () => {
    renderRow();

    expect(screen.queryByRole('button', { name: /^Download/ })).not.toBeInTheDocument();
  });

  it('selects on Space and downloads on Enter, never the other way round', async () => {
    renderRow();
    screen.getByRole('row').focus();

    await userEvent.keyboard(' ');

    expect(checkbox()).toBeChecked();
    expect(openSpy).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(checkbox()).toBeChecked();
  });

  it('ignores a row click while the table is not selectable, and still downloads from the name link', async () => {
    renderRow(false);

    await userEvent.click(screen.getByText('May 4, 2026'));

    expect(screen.getByRole('row')).not.toHaveClass('selected');
    expect(openSpy).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('link', { name: 'Fish Habitat Report' }));

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
