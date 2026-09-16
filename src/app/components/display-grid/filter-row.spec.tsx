import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterRow } from './filter-row';
import type { FilterValues, GridColumn } from './types';

const columns: GridColumn[] = [
  { key: 'name', label: 'Name', filter: 'text' },
  {
    key: 'date',
    label: 'Date posted',
    filter: 'year',
    date: true,
    options: [
      { value: '2019', label: '2019' },
      { value: '2024', label: '2024' },
    ],
  },
  {
    key: 'type',
    label: 'Type',
    filter: 'values',
    options: [
      { value: 'letter', label: 'Letter' },
      { value: 'report', label: 'Report' },
    ],
  },
  { key: 'size', label: 'Size', filter: null },
];

function renderRow(values: FilterValues = {}) {
  const onChange = vi.fn();
  render(
    <table>
      <thead>
        <FilterRow columns={columns} values={values} onChange={onChange} top={34} />
      </thead>
    </table>,
  );
  return onChange;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('FilterRow', () => {
  it('labels every control with the column it filters', () => {
    renderRow();

    expect(screen.getByLabelText('Filter by Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Date posted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by Type' })).toBeInTheDocument();
  });

  it('leaves the cell of an unfilterable column empty', () => {
    renderRow();

    expect(screen.queryByLabelText('Filter by Size')).not.toBeInTheDocument();
  });

  it('holds a typed value back until typing stops', () => {
    vi.useFakeTimers();
    const onChange = renderRow();

    // fireEvent, not userEvent: its key-by-key timing fights the fake clock this test owns.
    fireEvent.change(screen.getByLabelText('Filter by Name'), { target: { value: 'cedar' } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('name', 'cedar');
  });

  it('offers the years newest first under "Any date"', () => {
    renderRow();

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Any date', '2024', '2019']);
  });

  it('applies a year as soon as it is chosen', async () => {
    const user = userEvent.setup();
    const onChange = renderRow();

    await user.selectOptions(screen.getByLabelText('Filter by Date posted'), '2024');

    expect(onChange).toHaveBeenCalledWith('date', '2024');
  });

  it('sticks the row under the measured header height', () => {
    renderRow();

    const cell = screen.getByLabelText('Filter by Name').closest('td');
    expect(cell).toHaveStyle({ top: '34px' });
  });

  it('carries the hook the parity gate finds the filter row by', () => {
    renderRow();

    const cell = screen.getByLabelText('Filter by Name').closest('td');
    expect(cell?.closest('tr')).toHaveAttribute('data-tour', 'filterrow');
  });
});
