import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridHeader } from './grid-header';
import type { GridColumn, SortState } from './types';

const columns: GridColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date posted', date: true },
  { key: 'type', label: 'Type', sortable: false },
];

function renderHeader(sort: SortState | null, selectable = false) {
  const onSort = vi.fn();
  const onToggleAll = vi.fn();
  render(
    <table>
      <thead>
        <GridHeader
          columns={columns}
          sort={sort}
          onSort={onSort}
          selectable={selectable}
          onToggleAll={onToggleAll}
        />
      </thead>
    </table>,
  );
  return { onSort, onToggleAll };
}

describe('GridHeader', () => {
  it('marks only the sorted column with aria-sort', () => {
    renderHeader({ key: 'date', dir: 'desc' });

    expect(screen.getByRole('columnheader', { name: /date posted/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /name/i })).not.toHaveAttribute('aria-sort');
  });

  it('reads ascending when the sorted column is ascending', () => {
    renderHeader({ key: 'name', dir: 'asc' });

    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('asks for the column when its heading is clicked', async () => {
    const user = userEvent.setup();
    const { onSort } = renderHeader(null);

    await user.click(screen.getByRole('button', { name: /date posted/i }));

    expect(onSort).toHaveBeenCalledWith('date');
  });

  it('offers no sort button on a column that cannot be sorted', () => {
    renderHeader(null);

    expect(screen.queryByRole('button', { name: /^type/i })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument();
  });

  it('adds a select-all checkbox only when the grid is selectable', async () => {
    const user = userEvent.setup();
    const { onToggleAll } = renderHeader(null, true);

    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));

    expect(onToggleAll).toHaveBeenCalled();
  });
});
