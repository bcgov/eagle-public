import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearSelection, setSelected } from 'app/state/bulk-download';
import { clearToasts } from 'app/state/toast';
import {
  tableObject,
  type ITableMessage,
  type TableObject,
} from 'app/components/table/table-object';
import { DataTable, SelectCell } from './data-table';

const COLUMNS = [
  { name: 'Name', value: 'displayName' },
  { name: 'Date', value: 'datePosted' },
];

const DOCS = [
  { _id: 'doc-a', displayName: 'Alpha' },
  { _id: 'doc-b', displayName: 'Beta' },
];

const SELECT_ALL_PAGE = 'Select all on this page';

function NameRow({ rowData, tableData }: { rowData: any; tableData: TableObject }) {
  return (
    <tr>
      {tableData.options.selectable && <SelectCell rowData={rowData} tableId={tableData.tableId} />}
      <td>{rowData.displayName}</td>
      <td>{rowData.datePosted}</td>
    </tr>
  );
}

function table(overrides: Partial<TableObject> = {}): TableObject {
  return {
    ...tableObject({
      tableId: 'documents',
      component: NameRow as any,
      columns: COLUMNS,
      options: { ...tableObject({ tableId: 'x' }).options, selectable: true },
    }),
    items: DOCS.map((rowData) => ({ rowData })),
    totalListItems: DOCS.length,
    ...overrides,
  };
}

/** Owns the page state the way the real consumers do, so a control's effect is observable. */
function Harness({ totalListItems = 42 }: { totalListItems?: number }) {
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  function onMessage(message: ITableMessage): void {
    if (message.label === 'pageSize') setPageSize(message.data.value);
    if (message.label === 'pageNum') setCurrentPage(message.data);
  }

  return (
    <DataTable
      caption="Project documents"
      data={table({ totalListItems, pageSize, currentPage })}
      onMessage={onMessage}
    />
  );
}

describe('DataTable frame', () => {
  beforeEach(() => {
    clearSelection();
    clearToasts();
  });

  it('names the table with a visually-hidden caption', () => {
    render(<DataTable caption="Project documents" data={table()} onMessage={() => undefined} />);

    const caption = screen.getByRole('table').querySelector('caption');
    expect(caption).toHaveTextContent('Project documents');
    expect(caption).toHaveClass('visually-hidden');
  });

  it('shows the empty message instead of the grid when there is nothing to list', () => {
    render(
      <DataTable
        caption="Project documents"
        data={table({ items: [], totalListItems: 0 })}
        emptyMessage="No documents here"
        onMessage={() => undefined}
      />,
    );

    expect(screen.getByText('No documents here')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('DataTable selection', () => {
  beforeEach(() => {
    clearSelection();
    clearToasts();
  });

  it('ticks every row checkbox from the select-all checkbox', async () => {
    render(<DataTable caption="Documents" data={table()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    expect(screen.getByLabelText('Select Alpha')).toBeChecked();
    expect(screen.getByLabelText('Select Beta')).toBeChecked();
    expect(screen.getByLabelText(SELECT_ALL_PAGE)).toBeChecked();
  });

  it('clears every row checkbox when select-all is unticked', async () => {
    setSelected('documents', [
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' },
    ]);
    render(<DataTable caption="Documents" data={table()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    expect(screen.getByLabelText('Select Alpha')).not.toBeChecked();
    expect(screen.getByLabelText('Select Beta')).not.toBeChecked();
  });

  it('marks the select-all checkbox mixed while only part of the page is selected', async () => {
    render(<DataTable caption="Documents" data={table()} onMessage={() => undefined} />);

    await userEvent.click(screen.getByLabelText('Select Alpha'));

    const header = screen.getByLabelText(SELECT_ALL_PAGE) as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(header).toHaveAttribute('aria-checked', 'mixed');
  });

  it('offers no checkboxes while the table is not selectable', () => {
    render(
      <DataTable
        caption="Documents"
        data={table({ options: { selectable: false, showHeader: true } })}
        onMessage={() => undefined}
      />,
    );

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('DataTable action bar', () => {
  beforeEach(() => {
    clearSelection();
    clearToasts();
  });

  it('counts the documents while nothing is selected', () => {
    render(<DataTable caption="Documents" data={table()} onMessage={() => undefined} />);

    expect(screen.getByRole('status')).toHaveTextContent('2 documents');
    expect(screen.queryByRole('button', { name: /^Download/ })).not.toBeInTheDocument();
  });

  it('turns blue and offers Download N once rows are selected', async () => {
    const { container } = render(
      <DataTable caption="Documents" data={table()} onMessage={() => undefined} />,
    );

    await userEvent.click(screen.getByLabelText('Select Alpha'));

    expect(screen.getByRole('status')).toHaveTextContent('1 selected');
    expect(screen.getByRole('button', { name: /Download 1/ })).toBeInTheDocument();
    expect(container.querySelector('.data-table__bar--selected')).not.toBeNull();

    await userEvent.click(screen.getByLabelText('Select Beta'));

    expect(screen.getByRole('button', { name: /Download 2/ })).toBeInTheDocument();
  });

  it('drops the selection from the Clear button', async () => {
    const { container } = render(
      <DataTable caption="Documents" data={table()} onMessage={() => undefined} />,
    );

    await userEvent.click(screen.getByLabelText('Select Alpha'));
    await userEvent.click(screen.getByRole('button', { name: /Clear/ }));

    expect(screen.getByLabelText('Select Alpha')).not.toBeChecked();
    expect(container.querySelector('.data-table__bar--selected')).toBeNull();
  });

  // The offer only makes sense while the whole result set still fits the anonymous cap.
  it('offers select-all across pages once the page is full and asks for it on click', async () => {
    const onMessage = vi.fn();
    render(
      <DataTable
        caption="Documents"
        data={table({ totalListItems: 40, pageSize: 2 })}
        onMessage={onMessage}
      />,
    );

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));
    await userEvent.click(screen.getByRole('button', { name: 'Select all 40 documents' }));

    expect(onMessage).toHaveBeenCalledWith({ label: 'selectAllMatching' });
  });

  it('makes no select-all offer past the download cap', async () => {
    render(
      <DataTable
        caption="Documents"
        data={table({ totalListItems: 250, pageSize: 2 })}
        onMessage={() => undefined}
      />,
    );

    await userEvent.click(screen.getByLabelText(SELECT_ALL_PAGE));

    expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
  });
});

describe('DataTable loading', () => {
  beforeEach(() => {
    clearSelection();
    clearToasts();
  });

  /** The count sits in a live region, so a count the request has not answered yet must say nothing. */
  it('counts nothing while the results are still loading', () => {
    const { rerender } = render(
      <DataTable
        caption="Documents"
        data={table({ items: [], totalListItems: 0 })}
        loading
        onMessage={() => undefined}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(screen.queryByText('No documents')).not.toBeInTheDocument();

    rerender(<DataTable caption="Documents" data={table()} onMessage={() => undefined} />);

    expect(screen.getByRole('status')).toHaveTextContent('2 documents');
  });

  it('stands skeleton rows in while the first page is on its way', () => {
    const { container } = render(
      <DataTable
        caption="Documents"
        data={table({ items: [], totalListItems: 0 })}
        loading
        onMessage={() => undefined}
      />,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr.placeholder-wave')).toHaveLength(5);
  });

  it('dims the rows already on the page instead of replacing them', () => {
    const { container } = render(
      <DataTable caption="Documents" data={table()} loading onMessage={() => undefined} />,
    );

    expect(container.querySelector('.data-table__body--loading')).not.toBeNull();
    expect(container.querySelectorAll('tbody tr.placeholder-wave')).toHaveLength(0);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});

describe('DataTable footer', () => {
  beforeEach(() => {
    clearSelection();
    // jsdom has no scrollIntoView at all, so it has to be installed before paging can run.
    (Element.prototype as any).scrollIntoView = vi.fn();
  });

  it('pages from the pagination control', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));

    expect(screen.getByRole('button', { name: 'Go to page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('changes the page size from either per-page picker', async () => {
    render(<Harness />);

    expect(screen.getByRole('status')).toHaveTextContent('Showing 10 of 42 documents');

    const [top, bottom] = screen.getAllByTitle('Show 50 records per page');
    expect(bottom).toBeInTheDocument();

    await userEvent.click(top);

    expect(screen.getByRole('status')).toHaveTextContent('42 documents');
  });

  // The action bar already carries the count; a second one in the footer said it twice.
  it('counts the results once, in the action bar', () => {
    const { container } = render(<Harness />);

    expect(container.querySelectorAll('.data-table__bar-count')).toHaveLength(1);
    expect(container.querySelector('[id^="data-table-page-count-display"]')).toBeNull();
  });

  it('sorts from a column header', async () => {
    const onMessage = vi.fn();
    render(<DataTable caption="Documents" data={table()} onMessage={onMessage} />);

    await userEvent.click(
      within(screen.getByRole('columnheader', { name: 'Date' })).getByRole('button'),
    );

    expect(onMessage).toHaveBeenCalledWith({ label: 'columnSort', data: 'datePosted' });
  });
});
