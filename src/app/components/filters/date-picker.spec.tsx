import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './date-picker';

const FORMAT_ERROR = 'Use YYYY-MM-DD, for example 2025-06-01';

function field(value: string, onChange: (value: string) => void) {
  return (
    <>
      <label htmlFor="posted">Posted from</label>
      <DatePicker id="posted" label="Posted from" value={value} onChange={onChange} />
    </>
  );
}

function renderPicker(value = '') {
  const onChange = vi.fn();
  const view = render(field(value, onChange));
  return { onChange, rerender: (next: string) => view.rerender(field(next, onChange)) };
}

function input() {
  return screen.getByRole('textbox', { name: 'Posted from' });
}

describe('DatePicker', () => {
  it('is named by its visible label and described by the format it takes', () => {
    renderPicker();

    expect(input()).toHaveAccessibleDescription('YYYY-MM-DD');
    expect(input()).toHaveAttribute('placeholder', 'YYYY-MM-DD');
    expect(input()).not.toHaveAttribute('aria-invalid');
  });

  it('names its calendar and clear buttons after the field', () => {
    renderPicker('2024-01-15');

    expect(screen.getByRole('button', { name: 'Choose Posted from' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Posted from' })).toBeInTheDocument();
  });

  it('applies a typed date only once it is complete', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.type(input(), '2024-01-15');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('2024-01-15');
  });

  it('reads eight digits as the date they spell', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.type(input(), '20240115');

    expect(onChange).toHaveBeenLastCalledWith('2024-01-15');
  });

  it('refuses a day the month does not have, and says why', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.type(input(), '2024-02-31');

    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(FORMAT_ERROR);
    expect(input()).toHaveAccessibleDescription(`YYYY-MM-DD ${FORMAT_ERROR}`);
  });

  it('holds the error back while a date is part-typed, until the field is left', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(input(), '2024-01');
    expect(input()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.tab();

    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(FORMAT_ERROR);
  });

  it('applies an emptied field as no date', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker('2024-01-15');

    await user.clear(input());

    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('shows a value changed from outside over what was typed', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPicker('2024-01-15');

    await user.clear(input());
    await user.type(input(), '2024-0');
    await user.tab();
    // What a dropped chip does: the filter changes and the field follows, its error gone.
    rerender('2023-05-05');

    expect(input()).toHaveValue('2023-05-05');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens the calendar on a click and keeps typing in the field, moving the month', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker('2024-01-15');

    await user.click(input());
    expect(screen.getByRole('dialog', { name: 'Choose Posted from' })).toBeInTheDocument();
    expect(input()).toHaveFocus();

    await user.clear(input());
    await user.type(input(), '2023-03-10');

    expect(onChange).toHaveBeenLastCalledWith('2023-03-10');
    expect(screen.getByRole('grid', { name: 'March 2023' })).toBeInTheDocument();
  });

  it('writes the picked day as yyyy-mm-dd, closes the calendar and puts focus back', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker('2024-01-15');

    await user.click(input());
    await user.click(screen.getByRole('button', { name: /January 20th, 2024/ }));

    expect(onChange).toHaveBeenLastCalledWith('2024-01-20');
    expect(input()).toHaveValue('2024-01-20');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(input()).toHaveFocus();
  });

  it('opens from its button with focus on the days', async () => {
    const user = userEvent.setup();
    renderPicker('2024-01-15');

    await user.click(screen.getByRole('button', { name: 'Choose Posted from' }));

    const calendar = screen.getByRole('dialog', { name: 'Choose Posted from' });
    expect(within(calendar).getByRole('button', { name: /January 15th, 2024/ })).toHaveFocus();
  });

  it('hands Tab out of the calendar back to the field, closing it', async () => {
    const user = userEvent.setup();
    renderPicker('2024-01-15');

    await user.click(screen.getByRole('button', { name: 'Choose Posted from' }));
    await user.tab();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(input()).toHaveFocus();
  });

  it('closes the calendar on Escape and puts focus back in the field', async () => {
    const user = userEvent.setup();
    renderPicker('2024-01-15');

    await user.click(screen.getByRole('button', { name: 'Choose Posted from' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(input()).toHaveFocus();
  });
});
