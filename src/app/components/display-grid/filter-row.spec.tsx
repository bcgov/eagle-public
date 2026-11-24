import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterRow } from './filter-row';
import type { FilterValues, GridColumn } from './types';

const columns: GridColumn[] = [
  { key: 'name', label: 'Name', filter: 'text' },
  { key: 'date', label: 'Date posted', filter: 'date', date: true },
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
    expect(screen.getByRole('button', { name: 'Filter by Date posted' })).toBeInTheDocument();
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

  it('renders the text cell as a capped, unassisted text box', () => {
    renderRow();
    const box = screen.getByLabelText('Filter by Name');

    expect(box).toHaveAttribute('type', 'text');
    expect(box).toHaveAttribute('autocomplete', 'off');
    expect(box).toHaveAttribute('maxlength', '200');
    expect(box).toHaveAttribute('placeholder', 'Name');
  });

  it('shows a stored value the URL split on its comma as the one name that was typed', () => {
    renderRow({ name: ['Report', ' Volume 2'] });

    expect(screen.getByLabelText('Filter by Name')).toHaveValue('Report, Volume 2');
  });

  it.each([
    [{}, 'Any date'],
    [{ dateStart: '2024-01-15' }, 'From 2024-01-15'],
    [{ dateEnd: '2024-03-31' }, 'To 2024-03-31'],
    [{ dateStart: '2024-01-15', dateEnd: '2024-03-31' }, '2024-01-15 to 2024-03-31'],
    [{ dateStart: '2024-01-01', dateEnd: '2024-12-31' }, '2024'],
  ])('reads the date range %o on its button as %s', (values: FilterValues, text) => {
    renderRow(values);

    const button = screen.getByRole('button', { name: 'Filter by Date posted' });
    expect(within(button).getByText(text)).toBeInTheDocument();
  });

  it("writes a date column's From and To as the panel's own Start and End ids", async () => {
    const user = userEvent.setup();
    const onChange = renderRow();

    await user.click(screen.getByRole('button', { name: 'Filter by Date posted' }));
    await user.type(screen.getByRole('textbox', { name: 'From' }), '2024-01-15');
    await user.type(screen.getByRole('textbox', { name: 'To' }), '2024-03-31');

    expect(onChange).toHaveBeenCalledWith('dateStart', '2024-01-15');
    expect(onChange).toHaveBeenCalledWith('dateEnd', '2024-03-31');
  });

  it('clears both ends of a date range from its popover', async () => {
    const user = userEvent.setup();
    const onChange = renderRow({ dateStart: '2024-01-15', dateEnd: '2024-03-31' });

    await user.click(screen.getByRole('button', { name: 'Filter by Date posted' }));
    await user.click(screen.getByRole('button', { name: 'Clear Date posted' }));

    expect(onChange).toHaveBeenCalledWith('dateStart', '');
    expect(onChange).toHaveBeenCalledWith('dateEnd', '');
  });

  it('keeps the date popover open while a day is picked from its calendar', async () => {
    const user = userEvent.setup();
    const onChange = renderRow({ dateStart: '2024-01-15' });

    await user.click(screen.getByRole('button', { name: 'Filter by Date posted' }));
    await user.click(screen.getByRole('button', { name: 'Choose From' }));
    await user.click(screen.getByRole('button', { name: /January 20th, 2024/ }));

    expect(onChange).toHaveBeenCalledWith('dateStart', '2024-01-20');
    expect(screen.getByRole('group', { name: 'Filter by Date posted' })).toBeInTheDocument();
  });

  it('closes only the calendar on Escape inside it, leaving the date popover open', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole('button', { name: 'Filter by Date posted' }));
    await user.click(screen.getByRole('button', { name: 'Choose From' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Choose From' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by Date posted' })).toBeInTheDocument();
  });

  it('closes only the calendar on Escape in the field, leaving the date popover open', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole('button', { name: 'Filter by Date posted' }));
    await user.click(screen.getByRole('textbox', { name: 'From' }));
    expect(screen.getByRole('dialog', { name: 'Choose From' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Choose From' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by Date posted' })).toBeInTheDocument();
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
