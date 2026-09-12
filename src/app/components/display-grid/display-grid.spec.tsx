import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
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

/** The narrow sort select only offers the orders the columns say they can be sorted in. */
const sortableColumns: GridColumn<Doc>[] = columns.map((column) => ({ ...column, sortable: true }));

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
    <MemoryRouter>
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
      />
    </MemoryRouter>,
  );
  return { ...view, onPageChange, onPageSizeChange };
}

/** The narrow viewport the cards render at; jsdom answers every query false without this. */
function stubNarrow(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
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
    const { container } = renderGrid({ template: 'list', rowComponent: Row });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Application' })).toBeInTheDocument();
    expect(container.querySelectorAll('.display-grid__list > li')).toHaveLength(2);
  });

  it('hands the column filters to the panel when no column is on screen', () => {
    renderGrid({
      headerless: true,
      panel: (fields) => (
        <div data-testid="panel">{fields.map((field) => field.label).join(', ')}</div>
      ),
    });

    // The date column is not among them: its range is the panel's own field, not a second copy.
    expect(screen.getByTestId('panel')).toHaveTextContent('Name');
    expect(screen.getByTestId('panel')).not.toHaveTextContent('Date posted');
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('keeps the column filters out of the panel while the filter row shows them', () => {
    renderGrid({
      panel: (fields) => (
        <div data-testid="panel">{fields.map((field) => field.label).join(', ') || 'none'}</div>
      ),
    });

    expect(screen.getByTestId('panel')).toHaveTextContent('none');
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

  it('keeps the pager and the page sizes on screen when nothing matched', () => {
    renderGrid({ rows: [], total: 0, emptyMessage: 'No documents found' });

    // Page one of one, both arrows spent: the row under the grid does not come and go.
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Rows per page' })).toBeInTheDocument();
  });

  it('presses the page size in force', () => {
    renderGrid({ pageSize: 25 });

    expect(screen.getByRole('button', { name: '25' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '10' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves focus to the caption when the page changes', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    renderGrid({ total: 120 });

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));

    // Focus left on the pager is off screen after the scroll, so the next Tab starts nowhere.
    expect(screen.getByRole('caption')).toHaveFocus();
  });

  it('moves focus to the top of a list-mode grid too', async () => {
    function Row({ row }: { row: Doc }) {
      return <h3>{row.name}</h3>;
    }
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    renderGrid({ total: 120, template: 'list', rowComponent: Row });

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));

    expect(screen.getByText('Documents')).toHaveFocus();
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

    expect(
      within(body as HTMLElement)
        .getByText('2024-03-01')
        .closest('td'),
    ).toHaveClass('display-grid__cell--date');
  });
  it('hides the column headings and the filter row when nothing matched', () => {
    renderGrid({ rows: [], total: 0, emptyMessage: 'No documents match these filters' });

    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
    expect(document.querySelector('.display-grid__filter-row')).toBeNull();
    expect(screen.getByText('No documents match these filters')).toBeInTheDocument();
  });

  it('truncates a cell to one line and keeps the whole value as its tooltip', () => {
    renderGrid();

    expect(screen.getByText('Application')).toHaveAttribute('title', 'Application');
    expect(screen.getByText('Application')).toHaveClass('display-grid__cell-text');
  });

  it('links the record name when the column names a target', () => {
    const linked = columns.map((column) =>
      column.link ? { ...column, href: (row: Doc) => `/p/${row.id}` } : column,
    );
    renderGrid({ columns: linked });

    expect(screen.getByRole('link', { name: 'Application' })).toHaveAttribute('href', '/p/a');
  });

  it('leaves the record name as text when the column names no target', () => {
    renderGrid();

    expect(screen.queryByRole('link', { name: 'Application' })).not.toBeInTheDocument();
  });

  it('opens a target outside the app in its own tab', () => {
    const linked = columns.map((column) =>
      column.link
        ? { ...column, hrefExternal: true, href: (row: Doc) => `/demi-search/${row.id}` }
        : column,
    );
    renderGrid({ columns: linked });

    const link = screen.getByRole('link', { name: 'Application' });
    expect(link).toHaveAttribute('href', '/demi-search/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  describe('below the breakpoint', () => {
    it('renders one card per record instead of the table', () => {
      stubNarrow(true);
      const { container } = renderGrid();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Application', level: 3 })).toBeInTheDocument();
      expect(container.querySelectorAll('.display-grid__cards > li')).toHaveLength(rows.length);
    });

    it('shows each record attribute as a labelled pair, extras included', () => {
      stubNarrow(true);
      renderGrid({ narrowExtras: () => [{ label: 'Legislation', value: '2018 Act' }] });

      const card = screen.getAllByRole('listitem')[0] as HTMLElement;
      expect(within(card).getByText('2024-03-01')).toBeInTheDocument();
      expect(within(card).getByText('Legislation')).toBeInTheDocument();
      expect(within(card).getByText('2018 Act')).toBeInTheDocument();
    });

    it('links the card headline at the same target as the cell', () => {
      stubNarrow(true);
      const linked = columns.map((column) =>
        column.link ? { ...column, href: (row: Doc) => `/p/${row.id}` } : column,
      );
      renderGrid({ columns: linked });

      const card = screen.getAllByRole('listitem')[0] as HTMLElement;
      expect(within(card).getByRole('link', { name: 'Application' })).toHaveAttribute(
        'href',
        '/p/a',
      );
    });

    it('sorts from a select, naming the direction the reader picked', async () => {
      stubNarrow(true);
      const user = userEvent.setup();
      const onSort = vi.fn();
      renderGrid({ onSort, sort: { key: 'date', dir: 'desc' }, columns: sortableColumns });

      await user.selectOptions(screen.getByLabelText('Sort'), '+date');

      expect(onSort).toHaveBeenCalledWith('date', '+');
    });
  });
});
