import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvancedFilters } from './advanced-filters';
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
  { id: 'isFeatured', label: 'Featured documents', kind: 'toggle' },
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

function dateBox(name: string) {
  return screen.getByRole('textbox', { name });
}

describe('AdvancedFilters', () => {
  it('is hidden until it is opened, but stays in the document for aria-controls', () => {
    setup({}, false);

    expect(
      screen.getByRole('heading', { name: 'Advanced filters', hidden: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advanced filters' })).not.toBeInTheDocument();
  });

  it('reads the format, the format error and the hint for an invalid hinted date', async () => {
    const user = userEvent.setup();
    const hinted: AdvancedField[] = [
      { id: 'dateUpdatedStart', label: 'Updated from', kind: 'date', hint: 'Shows projects only' },
    ];
    render(
      <div className="display-grid">
        <AdvancedFilters fields={hinted} values={{}} onChange={vi.fn()} open />
      </div>,
    );

    await user.type(dateBox('Updated from'), '2025-13-45');

    expect(dateBox('Updated from')).toHaveAccessibleDescription(
      'YYYY-MM-DD Use YYYY-MM-DD, for example 2025-06-01 Shows projects only',
    );
  });

  it('applies the date under its own field id once it parses', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.type(dateBox('Posted to'), '2025-06-01');

    expect(onChange).toHaveBeenLastCalledWith('datePostedEnd', '2025-06-01');
  });

  it('clears the date filter when the field is emptied', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ datePostedStart: '2025-06-01' });

    await user.clear(dateBox('Posted from'));

    expect(onChange).toHaveBeenLastCalledWith('datePostedStart', null);
  });

  it('keeps a second date draft when only the first field changed', async () => {
    const user = userEvent.setup();
    const { applyValues } = setup();
    const half = dateBox('Posted to');

    await user.type(half, '2025-06');
    // Only the field whose applied filter moved may lose its draft.
    applyValues({ datePostedStart: '2025-06-01' });

    expect(dateBox('Posted from')).toHaveValue('2025-06-01');
    expect(half).toHaveValue('2025-06');
  });

  it('drops a never-parsed date when the applied filters are all cleared', async () => {
    const user = userEvent.setup();
    const { applyValues } = setup({ datePostedStart: '2025-06-01' });

    // Never parses, so it was never applied: only the set going empty can drop it.
    await user.type(dateBox('Posted to'), '2025-0');
    await user.tab();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    applyValues({});

    expect(dateBox('Posted to')).toHaveValue('');
    expect(dateBox('Posted from')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('emits true when a toggle is turned on', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByLabelText('Featured documents'));

    expect(onChange).toHaveBeenLastCalledWith('isFeatured', 'true');
  });

  it('removes the filter when a set toggle is turned off', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ isFeatured: 'true' });

    await user.click(screen.getByLabelText('Featured documents'));

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

  it('splits a select by Act, 2018 first, and emits the id of the term picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const decision: AdvancedField = {
      id: 'eacDecision',
      label: 'EA decision',
      kind: 'select',
      options: [
        { value: 'issued-2002', label: 'Certificate issued', legislation: '2002' },
        { value: 'issued-2018', label: 'Certificate issued', legislation: '2018' },
      ],
    };
    render(<AdvancedFilters fields={[decision]} values={{}} onChange={onChange} open />);
    const select = screen.getByLabelText('EA decision');

    const acts = within(select).getAllByRole('group');
    expect(acts.map((act) => act.getAttribute('label'))).toEqual([
      '2018 Act Terms',
      '2002 Act Terms',
    ]);
    expect(within(acts[1]).getByRole('option', { name: 'Certificate issued (2002)' })).toHaveValue(
      'issued-2002',
    );

    await user.selectOptions(select, 'issued-2002');
    expect(onChange).toHaveBeenCalledWith('eacDecision', 'issued-2002');
  });

  it('names the Act of the picked term in the closed select', () => {
    const decision: AdvancedField = {
      id: 'eacDecision',
      label: 'EA decision',
      kind: 'select',
      options: [
        { value: 'issued-2002', label: 'Certificate issued', legislation: '2002' },
        { value: 'issued-2018', label: 'Certificate issued', legislation: '2018' },
      ],
    };
    render(
      <AdvancedFilters
        fields={[decision]}
        values={{ eacDecision: 'issued-2002' }}
        onChange={vi.fn()}
        open
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>('EA decision');

    expect(select.selectedOptions[0]).toHaveTextContent('Certificate issued (2002)');
  });

  it('puts the terms with no Act last, under Other terms', () => {
    const phase: AdvancedField = {
      id: 'projectPhase',
      label: 'Phase',
      kind: 'select',
      options: [
        { value: 'other', label: 'Other' },
        { value: 'pre-2002', label: 'Pre-Application', legislation: '2002' },
        { value: 'pre-2018', label: 'Pre-Application', legislation: '2018' },
      ],
    };
    render(<AdvancedFilters fields={[phase]} values={{}} onChange={vi.fn()} open />);
    const select = screen.getByLabelText('Phase');

    const groups = within(select).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('label'))).toEqual([
      '2018 Act Terms',
      '2002 Act Terms',
      'Other terms',
    ]);
    expect(within(groups[2]).getByRole('option', { name: 'Other' })).toHaveValue('other');
  });

  it('drops a text filter when the box is emptied, once typing has stopped', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ proponent: 'Cedar' });

    await user.clear(screen.getByLabelText('Proponent'));

    // The panel carries a typed filter only where there is no filter row for it, and applies it
    // on the same beat as that row would: not on the keystroke.
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('proponent', null));
  });
});
