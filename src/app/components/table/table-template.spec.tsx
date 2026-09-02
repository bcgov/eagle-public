import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearSelection, selectedCount, setSelected, toggleSelected } from 'app/state/bulk-download';
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
function Harness() {
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const data = {
    ...tableObject({ component: NameRow as any, columns: COLUMNS }),
    items: [{ rowData: { _id: 'a', name: 'Alpha' } }],
    totalListItems: 42,
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

  it('offers a page size picker above and below the table', () => {
    render(<Harness />);

    expect(document.getElementById('table-template-page-size-picker-top')).toBeInTheDocument();
    expect(document.getElementById('table-template-page-size-picker')).toBeInTheDocument();
  });

  it('drives the shared page size from the top picker', async () => {
    render(<Harness />);
    const top = document.getElementById('table-template-page-size-picker-top')!;

    await userEvent.click(within(top).getByTitle('Show 25 records per page'));

    expect(screen.getByText('Showing 25 of 42 results')).toBeInTheDocument();
  });

  it('drives the same page size from the bottom picker', async () => {
    render(<Harness />);
    const bottom = document.getElementById('table-template-page-size-picker')!;

    await userEvent.click(within(bottom).getByTitle('Show 50 records per page'));

    expect(screen.getByText('Showing 42 of 42 results')).toBeInTheDocument();
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
  });

  it('offers no checkbox column while the table is not selectable', () => {
    render(<TableTemplate data={selectableTable({ options: { selectable: false } })} onMessage={() => undefined} />);

    expect(screen.queryByLabelText(SELECT_ALL_PAGE)).not.toBeInTheDocument();
  });

  it('selects every row on the page from the header checkbox', async () => {
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    expect(selectedCount('documents')).toBe(2);
    expect(screen.getByLabelText(SELECT_ALL_PAGE)).toBeChecked();
  });

  it('clears the selection when the header checkbox is unchecked', async () => {
    setSelected('documents', [
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' }
    ]);
    render(<TableTemplate data={selectableTable()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    expect(selectedCount('documents')).toBe(0);
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
