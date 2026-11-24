import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValuePicker } from './value-picker';
import type { ValueOption } from './types';

const options: ValueOption[] = [
  { value: 'letter', label: 'Letter' },
  { value: 'report', label: 'Report' },
  { value: 'map', label: 'Map' },
];

/** `count` proponents, Proponent 0 upwards. */
function proponents(count: number): ValueOption[] {
  return Array.from({ length: count }, (_, index) => ({
    value: `p${index}`,
    label: `Proponent ${index}`,
  }));
}

/** Over the 40 a list can show unsearched. */
const MANY = proponents(41);

function renderPicker(selected: string[] = [], list: ValueOption[] = options) {
  const onChange = vi.fn();
  render(<ValuePicker label="Type" options={list} selected={selected} onChange={onChange} />);
  return onChange;
}

function filterButton() {
  return screen.getByRole('button', { name: 'Filter by Type' });
}

function checkboxNames(): string[] {
  return screen.getAllByRole('checkbox').map((box) => box.parentElement?.textContent ?? '');
}

describe('ValuePicker', () => {
  it('reads All when nothing is picked', () => {
    renderPicker();

    expect(filterButton()).toHaveTextContent('All');
  });

  it('reads the single value that is picked', () => {
    renderPicker(['report']);

    expect(filterButton()).toHaveTextContent('Report');
  });

  it('counts several values and lists them in the title', () => {
    renderPicker(['report', 'map']);

    expect(filterButton()).toHaveTextContent('2 selected');
    expect(filterButton()).toHaveAttribute('title', 'Report, Map');
  });

  it('opens a checkbox list and reports the value that was ticked', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker(['report']);

    await user.click(filterButton());
    await user.click(screen.getByRole('checkbox', { name: 'Map' }));

    expect(onChange).toHaveBeenCalledWith(['report', 'map']);
  });

  it('clears every picked value', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker(['report', 'map']);

    await user.click(filterButton());
    const clear = screen.getByRole('button', { name: 'Clear Type' });
    // Several pickers sit in one row, so "Clear" alone does not say which one.
    expect(clear).toHaveTextContent('Clear');

    await user.click(clear);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('offers no Clear while nothing is picked', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(filterButton());

    expect(screen.queryByRole('button', { name: 'Clear Type' })).not.toBeInTheDocument();
  });

  it('offers no search box on a list of 40, short enough to scan', async () => {
    const user = userEvent.setup();
    renderPicker([], proponents(40));

    await user.click(filterButton());

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('opens a long list straight to its checkboxes, with the search box focused', async () => {
    const user = userEvent.setup();
    renderPicker([], MANY);

    await user.click(filterButton());

    expect(screen.getAllByRole('checkbox')).toHaveLength(41);
    expect(screen.getByRole('searchbox', { name: 'Search type' })).toHaveFocus();
  });

  it('narrows a long list to the values that hold the search, in any case', async () => {
    const user = userEvent.setup();
    renderPicker([], MANY);

    await user.click(filterButton());
    await user.keyboard('PROPONENT 4');

    expect(checkboxNames()).toEqual(['Proponent 4', 'Proponent 40']);
  });

  it('says No matches when no value holds the search', async () => {
    const user = userEvent.setup();
    renderPicker([], MANY);

    await user.click(filterButton());
    await user.keyboard('cedar');

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('keeps a pick the search hides', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker(['p1'], MANY);

    await user.click(filterButton());
    await user.keyboard('Proponent 2');
    await user.click(screen.getByRole('checkbox', { name: 'Proponent 2' }));

    expect(onChange).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('starts unfiltered each time it opens', async () => {
    const user = userEvent.setup();
    renderPicker([], MANY);

    await user.click(filterButton());
    await user.keyboard('Proponent 40');
    await user.keyboard('{Escape}');
    await user.click(filterButton());

    expect(screen.getByRole('searchbox', { name: 'Search type' })).toHaveValue('');
    expect(screen.getAllByRole('checkbox')).toHaveLength(41);
  });
});

describe('ValuePicker with terms from both Acts', () => {
  /** The same phase name under each Act, 2002 first as the List collection can send it. */
  const phases: ValueOption[] = [
    { value: 'pre-2002', label: 'Pre-Application', legislation: '2002' },
    { value: 'pre-2018', label: 'Pre-Application', legislation: '2018' },
    { value: 'early-2018', label: 'Early Engagement', legislation: '2018' },
  ];

  it('heads each Act with its own terms, 2018 first', async () => {
    const user = userEvent.setup();
    renderPicker([], phases);

    await user.click(filterButton());

    const acts = screen.getAllByRole('group', { name: /Act Terms$/ });
    expect(acts).toHaveLength(2);
    expect(acts[0]).toBe(screen.getByRole('group', { name: '2018 Act Terms' }));
    expect(acts[1]).toBe(screen.getByRole('group', { name: '2002 Act Terms' }));
    expect(within(acts[0]).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(acts[0]).getByRole('checkbox', { name: 'Pre-Application' })).toBeInTheDocument();
    expect(within(acts[1]).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(acts[1]).getByRole('checkbox', { name: 'Pre-Application' })).toBeInTheDocument();
  });

  it('reports the id of the Act whose term was ticked', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker([], phases);

    await user.click(filterButton());
    const act2002 = screen.getByRole('group', { name: '2002 Act Terms' });
    await user.click(within(act2002).getByRole('checkbox', { name: 'Pre-Application' }));

    expect(onChange).toHaveBeenCalledWith(['pre-2002']);
  });

  it('names the Act of a picked term on the button', () => {
    renderPicker(['pre-2002'], phases);

    expect(filterButton()).toHaveTextContent('Pre-Application (2002)');
  });

  it('keeps the Act groups in a long list, with the no-Act terms last as Other terms', async () => {
    const user = userEvent.setup();
    const longMixed: ValueOption[] = [
      ...phases,
      ...Array.from({ length: 38 }, (_, index) => ({
        value: `t${index}`,
        label: `Term ${index}`,
        legislation: '2018',
      })),
      { value: 'misc', label: 'Miscellaneous' },
    ];
    renderPicker([], longMixed);

    await user.click(filterButton());

    const popover = screen.getByRole('group', { name: 'Filter by Type' });
    expect(within(popover).getByRole('searchbox', { name: 'Search type' })).toBeInTheDocument();
    const other = screen.getByRole('group', { name: 'Other terms' });
    expect(within(popover).getAllByRole('group')).toEqual([
      screen.getByRole('group', { name: '2018 Act Terms' }),
      screen.getByRole('group', { name: '2002 Act Terms' }),
      other,
    ]);
    expect(within(other).getByRole('checkbox', { name: 'Miscellaneous' })).toBeInTheDocument();
  });
});
