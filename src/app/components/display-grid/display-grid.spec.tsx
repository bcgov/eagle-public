import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisplayGrid } from './display-grid';
import type { GridColumn } from './types';

interface Doc {
  id: string;
  name: string;
  date: string;
}

const columns: GridColumn<Doc>[] = [
  { key: 'name', label: 'Name', filter: 'text', link: true, locked: true },
  { key: 'date', label: 'Date posted', filter: 'year', date: true },
];

const rows: Doc[] = [
  { id: 'a', name: 'Application', date: '2024-03-01' },
  { id: 'b', name: 'Amendment', date: '2019-11-20' },
];

/** Lets a test drive the ResizeObserver the sticky filter row depends on. */
function mockResizeObserver() {
  const callbacks: (() => void)[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        callbacks.push(callback);
      }
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  );
  return { fire: () => act(() => callbacks.forEach((callback) => callback())) };
}

function renderGrid(props: Partial<React.ComponentProps<typeof DisplayGrid<Doc>>> = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  const view = render(
    <DisplayGrid<Doc>
      caption="Documents"
      columns={columns}
      rows={rows}
      page={1}
      pageSize={25}
      total={rows.length}
      rowId={(row) => row.id}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...props}
    />,
  );
  return { ...view, onPageChange, onPageSizeChange };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DisplayGrid', () => {
  it('renders one row per record under a named table', () => {
    renderGrid();

    expect(screen.getByRole('table', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Application' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2019-11-20' })).toBeInTheDocument();
  });

  it('moves the filter row when the header row changes height', () => {
    const observer = mockResizeObserver();
    let height = 34;
    vi.spyOn(HTMLTableRowElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          height,
          top: 0,
          bottom: height,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    renderGrid();

    const cell = screen.getByLabelText('Filter by Name').closest('td');
    expect(cell).toHaveStyle({ top: '34px' });

    height = 58;
    observer.fire();

    expect(cell).toHaveStyle({ top: '58px' });
  });

  it('keeps the rows on screen while the next page loads', () => {
    const { container } = renderGrid({ loading: true });

    expect(screen.getByRole('cell', { name: 'Application' })).toBeInTheDocument();
    expect(container.querySelector('.display-grid__body--loading')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('shows placeholder rows only when there is nothing to keep', () => {
    const { container } = renderGrid({ loading: true, rows: [] });

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(container.querySelectorAll('.display-grid__skeleton-bar').length).toBeGreaterThan(0);
    expect(screen.queryByText('No documents found')).not.toBeInTheDocument();
  });

  it('says the result set is empty once the request is done', () => {
    renderGrid({ rows: [], total: 0, emptyMessage: 'No documents found' });

    expect(screen.getByText('No documents found')).toBeInTheDocument();
  });

  it('renders list records without a table', () => {
    function Row({ row }: { row: Doc }) {
      return <h3>{row.name}</h3>;
    }
    renderGrid({ template: 'list', rowComponent: Row });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Application' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('hands the column filters to the panel when no column is on screen', () => {
    renderGrid({
      headerless: true,
      panel: (fields) => (
        <div data-testid="panel">{fields.map((field) => field.label).join(', ')}</div>
      ),
    });

    expect(screen.getByTestId('panel')).toHaveTextContent('Name, Date posted');
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('scrolls the grid back into view when the page changes', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    const { onPageChange } = renderGrid({ total: 120 });

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('reports the page size the reader picks', async () => {
    const user = userEvent.setup();
    const { onPageSizeChange } = renderGrid();

    await user.click(screen.getByRole('button', { name: '50' }));

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('selects a row by its name', async () => {
    const user = userEvent.setup();
    const onToggleRow = vi.fn();
    renderGrid({
      selectable: true,
      rowLabel: (row) => row.name,
      selectedIds: ['a'],
      onToggleRow,
    });

    const first = screen.getByRole('checkbox', { name: 'Select Application' });
    expect(first).toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Select Amendment' }));
    expect(onToggleRow).toHaveBeenCalledWith(rows[1]);
  });

  it('marks the header checkbox mixed while only some rows are selected', () => {
    renderGrid({ selectable: true, selectedIds: ['a'], rowLabel: (row) => row.name });

    expect(screen.getByRole('checkbox', { name: 'Select all on this page' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });

  it('puts the date class on date cells so the digits line up', () => {
    const { container } = renderGrid();
    const body = container.querySelector('tbody');

    expect(within(body as HTMLElement).getByText('2024-03-01')).toHaveClass(
      'display-grid__cell--date',
    );
  });
});
