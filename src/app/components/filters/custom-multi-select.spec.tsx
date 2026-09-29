import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomMultiSelect, type CustomMultiSelectOption } from './custom-multi-select';

/** The same phase name under each Act, each its own value. */
const phases: CustomMultiSelectOption[] = [
  { value: 'pre-2018', label: 'Pre-Application', legislation: '2018' },
  { value: 'early-2018', label: 'Early Engagement', legislation: '2018' },
  { value: 'pre-2002', label: 'Pre-Application', legislation: '2002' },
];

function renderSelect(selected: CustomMultiSelectOption[] = [], onChange = vi.fn()) {
  render(
    <CustomMultiSelect
      id="phase"
      items={phases}
      selected={selected}
      groupBy="legislation"
      placeholder="Search phase"
      onChange={onChange}
    />,
  );
  return onChange;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CustomMultiSelect', () => {
  it('narrows to one Act when the search names its year', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole('combobox', { name: 'Search phase' }));
    await user.type(screen.getByRole('textbox', { name: 'Search options' }), '2018');

    expect(screen.queryByRole('group', { name: '2002' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '2018' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Pre-Application',
      'Early Engagement',
    ]);
  });

  it('names the Act on a chip remove button and drops only that term', async () => {
    const user = userEvent.setup();
    const onChange = renderSelect([phases[0], phases[2]]);

    await user.click(screen.getByRole('button', { name: 'Remove Pre-Application (2002)' }));

    expect(onChange).toHaveBeenCalledWith([phases[0]]);
  });

  it('keys options by value, so two of one name draw without a key clash', async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <CustomMultiSelect
        items={[
          { value: 'a', label: 'Amendment' },
          { value: 'b', label: 'Amendment' },
        ]}
        selected={[]}
        placeholder="Search milestone"
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Search milestone' }));

    expect(screen.getAllByRole('option', { name: 'Amendment' })).toHaveLength(2);
    const clashes = error.mock.calls.filter((call) => String(call[0]).includes('same key'));
    expect(clashes).toEqual([]);
  });
});
