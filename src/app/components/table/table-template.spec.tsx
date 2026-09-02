import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearJob, clearSelection, SELECT_ALL_MAX, setJob, setSelected, toggleSelected } from 'app/state/bulk-download';
import { clearToasts, useToasts } from 'app/state/toast';
import { TableTemplate } from './table-template';
import { tableObject, type ITableMessage, type TableObject } from './table-object';

const COLUMNS = [{ name: 'Name', value: 'name' }];

function NameRow({ rowData }: { rowData: any }) {
  return (
    <tr>
      <td>{rowData.name}</td>
    </tr>
  );
}

/** Owns the page state the way the real consumers do, so a control's effect is observable. */
function Harness({ totalListItems = 42 }: { totalListItems?: number }) {
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const data = {
    ...tableObject({ component: NameRow as any, columns: COLUMNS }),
    items: [{ rowData: { _id: 'a', name: 'Alpha' } }],
    totalListItems,
    pageSize,
    currentPage
  };

  function onMessage(message: ITableMessage): void {
    if (message.label === 'pageSize') setPageSize(message.data.value);
    if (message.label === 'pageNum') setCurrentPage(message.data);
  }

  return <TableTemplate data={data} onMessage={onMessage} />;
}

describe('TableTemplate page controls', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // jsdom has no scrollIntoView at all, so it has to be installed before it can be observed.
    scrollIntoView = vi.fn();
    (Element.prototype as any).scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    delete (Element.prototype as any).scrollIntoView;
  });

  it('offers one page size picker, below the table', () => {
    render(<Harness />);

    expect(document.querySelectorAll('.lib-page-size-display')).toHaveLength(1);
    const picker = document.getElementById('table-template-page-size-picker')!;
    expect(picker.compareDocumentPosition(screen.getByLabelText('table-template'))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    );
  });

  it('drives the page size from the picker', async () => {
    render(<Harness />);
    const picker = document.getElementById('table-template-page-size-picker')!;

    await userEvent.click(within(picker).getByTitle('Show 50 records per page'));

    expect(screen.getByText('Showing 42 of 42 results')).toBeInTheDocument();
  });

  // Angular hid the picker under 11 results: nothing there to page through.
  it('hides the picker while the whole result set fits on one page', () => {
    render(<Harness totalListItems={10} />);

    expect(document.getElementById('table-template-page-size-picker')).not.toBeInTheDocument();
  });

  it('scrolls back to the top of the grid on a page change', async () => {
    render(<Harness />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Go to page 2' })[0]);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});

const ALPHA = { _id: 'doc-a', displayName: 'Alpha' };
const BETA = { _id: 'doc-b', displayName: 'Beta' };

function selectableTable(overrides: Partial<TableObject> = {}): TableObject {
  const base = tableObject({ component: NameRow as any, columns: COLUMNS, tableId: 'documents' });
  return {
    ...base,
    items: [{ rowData: ALPHA }, { rowData: BETA }],
    totalListItems: 60,
    pageSize: 10,
    options: { ...base.options, selectable: true },
    ...overrides
  };
}

/**
 * The checkbox column is the whole entry point to bulk download, and the banner is the only way
 * past one page of it, so both are gated on `selectable` and on the anonymous 100-document cap.
 */
describe('TableTemplate selection', () => {
  const SELECT_ALL_PAGE = 'Select all on this page';

  beforeEach(() => {
    clearSelection();
    clearToasts();
  });

  it('offers no checkbox column while the table is not selectable', () => {
    render(<TableTemplate data={selectableTable({ options: { selectable: false } })} onMessage={() => undefined} />);

    expect(screen.queryByLabelText(SELECT_ALL_PAGE)).not.toBeInTheDocument();
  });

  it('selects every row on the page from the header checkbox', async () => {
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    expect(screen.getByLabelText(SELECT_ALL_PAGE)).toBeChecked();
    expect(screen.getByText('All 2 on this page are selected.')).toBeInTheDocument();
  });

  it('clears the selection when the header checkbox is unchecked', async () => {
    setSelected('documents', [
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' }
    ]);
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    const header = screen.getByLabelText(SELECT_ALL_PAGE) as HTMLInputElement;
    expect(header).not.toBeChecked();
    expect(header.indeterminate).toBe(false);
  });

  // Page 2 of a grid where the reader already holds the whole anonymous quota.
  it('says so instead of selecting a page that would pass the 100-document cap', async () => {
    setSelected(
      'documents',
      Array.from({ length: SELECT_ALL_MAX }, (_, i) => ({ id: `other-${i}`, displayName: `Other ${i}` }))
    );
    const toasts = renderHook(() => useToasts());
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    expect(toasts.result.current.map(toast => toast.message)).toEqual([
      'You can select up to 100 documents at a time.'
    ]);
    expect(screen.getByLabelText(SELECT_ALL_PAGE)).not.toBeChecked();
  });

  it('reads as indeterminate while only part of the page is selected', () => {
    toggleSelected('documents', { id: 'doc-a', displayName: 'Alpha' });

    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    const header = screen.getByLabelText(SELECT_ALL_PAGE) as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);
  });
});

describe('TableTemplate select-all banner', () => {
  beforeEach(() => {
    clearSelection();
    setSelected('documents', [
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' }
    ]);
  });

  it('stays hidden while the whole result set fits on the page', () => {
    render(<TableTemplate data={selectableTable({ totalListItems: 2 })} onMessage={() => undefined} />);

    expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
  });

  // Boundary at the page size itself, e.g. page size "All" showing 19 of 19: nothing is left off
  // the page, so the banner must not appear. Catches `>` in the guard regressing to `>=`.
  it('stays hidden when the result count exactly equals the page size', () => {
    render(<TableTemplate data={selectableTable({ totalListItems: 10, pageSize: 10 })} onMessage={() => undefined} />);

    expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
  });

  it('offers select-all once the result count passes the page size by one', () => {
    render(<TableTemplate data={selectableTable({ totalListItems: 11, pageSize: 10 })} onMessage={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Select all 11 matching documents' })).toBeInTheDocument();
  });

  it('offers the rest of the result set once the page is fully selected', async () => {
    const onMessage = vi.fn();
    render(<TableTemplate data={selectableTable()} onMessage={onMessage} />);

    expect(screen.getByText('All 2 on this page are selected.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Select all 60 matching documents' }));

    expect(onMessage).toHaveBeenCalledWith({ label: 'selectAllMatching' });
  });

  it('names the tab on the Application tab', () => {
    clearSelection();
    setSelected('application', [
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' }
    ]);

    render(<TableTemplate data={selectableTable({ tableId: 'application' })} onMessage={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Select all 60 Application documents' })).toBeInTheDocument();
  });

  it('asks for narrower filters past the 100-document cap instead of offering select-all', () => {
    render(<TableTemplate data={selectableTable({ totalListItems: 250 })} onMessage={() => undefined} />);

    expect(screen.getByText('Narrow your filters to 100 or fewer documents to select them all.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
  });
});

/**
 * The toolbar is where a selection turns into a download: it replaces the fixed bar, so the POST
 * and the Clear are driven from here.
 */
describe('TableTemplate selection toolbar', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearSelection();
    clearJob();
    fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: 'job-1', status: 'queued' }), { status: 202 })
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    clearJob();
    vi.unstubAllGlobals();
  });

  it('stays hidden while nothing is selected', () => {
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('counts the selection and offers Download', async () => {
    setSelected('documents', [{ id: 'doc-a', displayName: 'Alpha' }]);
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();

    await userEvent.click(screen.getByLabelText('Select all on this page'));

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  // Both tabs of a project's documents post as one job, so the count is every table's.
  it('counts what another table holds selected as well', () => {
    setSelected('documents', [{ id: 'doc-a', displayName: 'Alpha' }]);
    setSelected('search', [{ id: 'doc-z', displayName: 'Zulu' }]);

    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('posts every selected document and keeps the job it gets back', async () => {
    setSelected('documents', [
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' }
    ]);
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/bulk-downloads');
    expect(JSON.parse(init.body)).toEqual({ documentIds: ['doc-a', 'doc-b'] });
    await waitFor(() => expect(localStorage.getItem('epic-bulk-download-job')).toContain('job-1'));
    // The job owns the download now, so the toolbar goes with the selection it posted.
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('drops the selection on Clear without posting anything', async () => {
    setSelected('documents', [{ id: 'doc-a', displayName: 'Alpha' }]);
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Select all on this page')).not.toBeChecked();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // One job slot: a second POST would replace the running one and lose the zip it was building.
  it('refuses a second download while one is still running', () => {
    setJob({ id: 'job-9', count: 3, startedAt: Date.now(), status: 'running' });
    setSelected('documents', [{ id: 'doc-a', displayName: 'Alpha' }]);

    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
  });

  // A job that reached its last status is not still running; the panel only shows what it did.
  it.each(['ready', 'failed', 'expired'] as const)('offers Download again once a job is %s', status => {
    setJob({ id: 'job-9', count: 3, startedAt: Date.now(), status });
    setSelected('documents', [{ id: 'doc-a', displayName: 'Alpha' }]);

    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });
});
