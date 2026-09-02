import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { loadConfig } from 'app/config/config';
import { tableObject } from 'app/components/table/table-object';
import { clearSelection } from 'app/state/bulk-download';
import { DocSearchTableRow } from './search-documents-table-rows';

const DOCUMENT = {
  _id: 'doc-1',
  displayName: 'Fish Habitat Report',
  documentFileName: 'fish-habitat.pdf',
  datePosted: '2026-05-04T00:00:00.000Z',
  project: { _id: 'proj-1', name: 'Alpha Mine' }
};

const DOWNLOAD_URL = '/api/public/document/doc-1/download/fish-habitat.pdf';

/** The Name cell is a real link here too, and the row's only download. */
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
    expect(screen.getByRole('link', { name: 'Fish Habitat Report' })).toHaveAttribute('href', DOWNLOAD_URL);
  });

  it('starts the download on click rather than following the href', async () => {
    await userEvent.click(screen.getByRole('link', { name: 'Fish Habitat Report' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(DOWNLOAD_URL, '_blank');
  });

  it('renders no download button; the name link is the only per-row download', () => {
    expect(screen.queryByRole('button', { name: /^Download/ })).not.toBeInTheDocument();
  });
});

/** Search rows behave exactly as the project's document rows do: same clicks, same keys. */
describe('DocSearchTableRow row interaction', () => {
  const originalEnv = window.__env;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '' };
    await loadConfig();
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    clearSelection();
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

  const checkbox = () => screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' });

  it('renders no checkbox while the table is not selectable', () => {
    renderRow(false);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('selects the document from its checkbox and marks the row', async () => {
    renderRow();

    await userEvent.click(checkbox());

    expect(checkbox()).toBeChecked();
    expect(screen.getByRole('row')).toHaveClass('selected');
  });

  it('selects the document when a metadata cell is clicked, and downloads nothing', async () => {
    renderRow();

    await userEvent.click(screen.getByText('May 4, 2026'));

    expect(checkbox()).toBeChecked();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('leaves the project link as a link, selecting nothing', async () => {
    renderRow();

    await userEvent.click(screen.getByRole('link', { name: 'Link to project Alpha Mine' }));

    expect(checkbox()).not.toBeChecked();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('selects on Space and downloads on Enter, never the other way round', async () => {
    renderRow();
    screen.getByRole('row').focus();

    await userEvent.keyboard(' ');

    expect(checkbox()).toBeChecked();
    expect(openSpy).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');

    expect(openSpy).toHaveBeenCalledTimes(1);
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
