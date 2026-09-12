import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvancedFilters, isValidIsoDate } from './advanced-filters';
import type { AdvancedField, FilterValues } from './types';

const fields: AdvancedField[] = [
  { id: 'datePostedStart', label: 'Posted from', kind: 'date' },
  { id: 'datePostedEnd', label: 'Posted to', kind: 'date' },
  {
    id: 'legislation',
    label: 'Legislation',
    kind: 'select',
    options: [
      { value: '1996', label: '1996 Act' },
      { value: '2018', label: '2018 Act' },
    ],
  },
  { id: 'isFeatured', label: 'Featured only', kind: 'toggle' },
  { id: 'proponent', label: 'Proponent', kind: 'text' },
];

function setup(values: FilterValues = {}, open = true) {
  const onChange = vi.fn();
  const panel = (applied: FilterValues) => (
    <div className="display-grid">
      <AdvancedFilters fields={fields} values={applied} onChange={onChange} open={open} />
    </div>
  );
  const view = render(panel(values));
  return { onChange, view, applyValues: (applied: FilterValues) => view.rerender(panel(applied)) };
}

describe('isValidIsoDate', () => {
  it('takes a real calendar date and refuses a shaped one', () => {
    expect(isValidIsoDate('2025-06-01')).toBe(true);
    expect(isValidIsoDate('2025-02-31')).toBe(false);
    expect(isValidIsoDate('01/06/2025')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});

describe('AdvancedFilters', () => {
  it('is hidden until it is opened, but stays in the document for aria-controls', () => {
    setup({}, false);

    expect(
      screen.getByRole('heading', { name: 'Advanced filters', hidden: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advanced filters' })).not.toBeInTheDocument();
  });

  it('shows an error and filters nothing while a date is unparseable', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.type(screen.getByLabelText(/Posted from/), '2025-13-45');

    expect(screen.getByRole('alert')).toHaveTextContent('Use YYYY-MM-DD');
    expect(screen.getByLabelText(/Posted from/)).toHaveAttribute('aria-invalid', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies the date once it parses', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.type(screen.getByLabelText(/Posted from/), '2025-06-01');

    expect(onChange).toHaveBeenCalledWith('datePostedStart', '2025-06-01');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the date filter when the field is emptied', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ datePostedStart: '2025-06-01' });

    await user.clear(screen.getByLabelText(/Posted from/));

    expect(onChange).toHaveBeenLastCalledWith('datePostedStart', null);
  });

  it('empties a typed date once the filter is cleared somewhere else', async () => {
    const user = userEvent.setup();
    const { applyValues } = setup();
    const input = screen.getByLabelText(/Posted from/);

    await user.type(input, '2025-06-01');
    applyValues({ datePostedStart: '2025-06-01' });
    expect(input).toHaveValue('2025-06-01');

    // What the chip row and Clear all do: the filter goes, the panel has to follow.
    applyValues({});

    expect(input).toHaveValue('');
  });

  it('keeps a half-typed date while the applied filters stay put', async () => {
    const user = userEvent.setup();
    const { applyValues } = setup();
    const input = screen.getByLabelText(/Posted from/);

    await user.type(input, '2025-06');
    applyValues({ proponent: 'Cedar' });

    expect(input).toHaveValue('2025-06');
  });

  it('keeps a second date draft when only the first field changed', async () => {
    const user = userEvent.setup();
    const { applyValues } = setup();
    const half = screen.getByLabelText(/Posted to/);

    await user.type(half, '2025-06');
    // Only the field whose applied filter moved may lose its draft.
    applyValues({ datePostedStart: '2025-06-01' });

    expect(screen.getByLabelText(/Posted from/)).toHaveValue('2025-06-01');
    expect(half).toHaveValue('2025-06');
  });

  it('drops a never-parsed date when the applied filters are all cleared', async () => {
    const user = userEvent.setup();
    const { applyValues } = setup({ datePostedStart: '2025-06-01' });
    const half = screen.getByLabelText(/Posted to/);

    // Never parses, so it was never applied: only the set going empty can drop it.
    await user.type(half, '2025-06');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    applyValues({});

    expect(half).toHaveValue('');
    expect(screen.getByLabelText(/Posted from/)).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('emits true when a toggle is turned on', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByLabelText('Featured only'));

    expect(onChange).toHaveBeenLastCalledWith('isFeatured', 'true');
  });

  it('removes the filter when a set toggle is turned off', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ isFeatured: 'true' });

    await user.click(screen.getByLabelText('Featured only'));

    expect(onChange).toHaveBeenLastCalledWith('isFeatured', null);
  });

  it('offers All first on a select and emits the picked value', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const select = screen.getByLabelText('Legislation');

    expect(within(select).getAllByRole('option')[0]).toHaveTextContent('All');

    await user.selectOptions(select, '2018');
    expect(onChange).toHaveBeenCalledWith('legislation', '2018');
  });

  it('drops a text filter when the box is emptied', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ proponent: 'Cedar' });

    await user.clear(screen.getByLabelText('Proponent'));

    expect(onChange).toHaveBeenLastCalledWith('proponent', null);
  });
});
