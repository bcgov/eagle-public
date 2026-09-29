import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValuePicker } from './value-picker';
import type { ValueOption } from './types';

const options: ValueOption[] = [
  { value: 'letter', label: 'Letter' },
  { value: 'report', label: 'Report' },
  { value: 'map', label: 'Map' },
];

function renderPicker(selected: string[] = [], list: ValueOption[] = options) {
  const onChange = vi.fn();
  render(<ValuePicker label="Type" options={list} selected={selected} onChange={onChange} />);
  return onChange;
}

/** Puts the button where it is asked to be, so the popover's geometry can be asserted. */
function placeButton(top: number, bottom: number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom,
    left: 40,
    right: 240,
    width: 200,
    height: bottom - top,
    x: 40,
    y: top,
    toJSON: () => ({}),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ValuePicker', () => {
  it('reads All when nothing is picked', () => {
    renderPicker();

    expect(screen.getByRole('button', { name: 'Filter by Type' })).toHaveTextContent('All');
  });

  it('reads the single value that is picked', () => {
    renderPicker(['report']);

    expect(screen.getByRole('button', { name: 'Filter by Type' })).toHaveTextContent('Report');
  });

  it('counts several values and lists them in the title', () => {
    renderPicker(['report', 'map']);

    const button = screen.getByRole('button', { name: 'Filter by Type' });
    expect(button).toHaveTextContent('2 selected');
    expect(button).toHaveAttribute('title', 'Report, Map');
  });

  it('opens a checkbox list and reports the value that was ticked', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker(['report']);

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    expect(screen.getByRole('button', { name: 'Filter by Type' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('checkbox', { name: 'Map' }));
    expect(onChange).toHaveBeenCalledWith(['report', 'map']);
  });

  it('calls the popover what it is, and names it only while it exists', async () => {
    const user = userEvent.setup();
    renderPicker();
    const button = screen.getByRole('button', { name: 'Filter by Type' });

    // A group of checkboxes is not a listbox, and there is nothing to control while it is shut.
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).not.toHaveAttribute('aria-controls');

    await user.click(button);

    const popover = screen.getByRole('group', { name: 'Filter by Type' });
    expect(popover.id).not.toBe('');
    expect(button).toHaveAttribute('aria-controls', popover.id);
  });

  it('heads the open list with the column it filters, and is named by it', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

    const popover = screen.getByRole('group', { name: 'Filter by Type' });
    const head = within(popover).getByText('Filter by Type');
    expect(popover).toHaveAttribute('aria-labelledby', head.id);
    expect(popover).not.toHaveAttribute('aria-label');
    const first = screen.getByRole('checkbox', { name: 'Letter' });
    expect(head.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens below the button when there is room', async () => {
    placeButton(120, 150);
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

    const popover = screen.getByRole('group', { name: 'Filter by Type' });
    expect(popover).toHaveStyle({ top: '152px' });
    expect(popover.style.bottom).toBe('');
  });

  it('flips above the button when the space below cannot hold a usable list', async () => {
    placeButton(700, 730);
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

    const popover = screen.getByRole('group', { name: 'Filter by Type' });
    expect(popover.style.bottom).toBe(`${window.innerHeight - 698}px`);
    expect(popover.style.top).toBe('');
  });

  it('keeps the popover on the viewport it measured when a later render sees a different one', async () => {
    vi.stubGlobal('innerHeight', 900);
    placeButton(400, 430);
    const user = userEvent.setup();
    const { rerender } = render(
      <ValuePicker label="Type" options={options} selected={[]} onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    const popover = screen.getByRole('group', { name: 'Filter by Type' });
    expect(popover).toHaveStyle({ top: '432px' });

    // A full-page screenshot changes the viewport and fires no resize; an unrelated render must
    // not read it and take the popover off its button.
    vi.stubGlobal('innerHeight', 500);
    rerender(
      <ValuePicker label="Type" options={options} selected={['report']} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Clear Type' })).toBeInTheDocument();
    expect(popover).toHaveStyle({ top: '432px' });
    expect(popover.style.bottom).toBe('');

    // A real resize closes the popover, so the next open measures the viewport it now has.
    fireEvent(window, new Event('resize'));
    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

    const reopened = screen.getByRole('group', { name: 'Filter by Type' });
    expect(reopened).toHaveStyle({ bottom: '102px' });
    expect(reopened.style.top).toBe('');
  });

  it('closes on Escape and puts focus back on the button', async () => {
    const user = userEvent.setup();
    renderPicker();
    const button = screen.getByRole('button', { name: 'Filter by Type' });

    await user.click(button);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group', { name: 'Filter by Type' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes when something outside is pressed', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Elsewhere</button>
        <ValuePicker label="Type" options={options} selected={[]} onChange={vi.fn()} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(screen.queryByRole('group', { name: 'Filter by Type' })).not.toBeInTheDocument();
  });

  it('closes on scroll, because a fixed popover does not follow its button', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    fireEvent.scroll(document);

    expect(screen.queryByRole('group', { name: 'Filter by Type' })).not.toBeInTheDocument();
  });

  it('stays open while its own option list is scrolled', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    const popover = screen.getByRole('group', { name: 'Filter by Type' });
    fireEvent.scroll(popover);

    expect(screen.getByRole('group', { name: 'Filter by Type' })).toBeInTheDocument();
  });

  it('clears every picked value', async () => {
    const user = userEvent.setup();
    const onChange = renderPicker(['report', 'map']);

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    const clear = screen.getByRole('button', { name: 'Clear Type' });
    // Several pickers sit in one row, so "Clear" alone does not say which one.
    expect(clear).toHaveTextContent('Clear');

    await user.click(clear);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('offers no Clear while nothing is picked', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

    expect(screen.queryByRole('button', { name: 'Clear Type' })).not.toBeInTheDocument();
  });

  it('hands a long list to the typeahead instead of a wall of checkboxes', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 41 }, (_, index) => ({
      value: `p${index}`,
      label: `Proponent ${index}`,
    }));
    renderPicker([], many);

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

    expect(screen.queryByRole('checkbox', { name: 'Proponent 0' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search type' })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

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

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    const act2002 = screen.getByRole('group', { name: '2002 Act Terms' });
    await user.click(within(act2002).getByRole('checkbox', { name: 'Pre-Application' }));

    expect(onChange).toHaveBeenCalledWith(['pre-2002']);
  });

  it('names the Act of a picked term on the button', () => {
    renderPicker(['pre-2002'], phases);

    expect(screen.getByRole('button', { name: 'Filter by Type' })).toHaveTextContent(
      'Pre-Application (2002)',
    );
  });

  it('heads each Act in the typeahead too', async () => {
    const user = userEvent.setup();
    const many: ValueOption[] = Array.from({ length: 42 }, (_, index) => ({
      value: `t${index}`,
      label: `Term ${Math.floor(index / 2)}`,
      legislation: index % 2 ? '2018' : '2002',
    }));
    renderPicker([], many);

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    await user.click(screen.getByRole('combobox', { name: 'Search type' }));

    const newer = screen.getByRole('group', { name: '2018 Act Terms' });
    const older = screen.getByRole('group', { name: '2002 Act Terms' });
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(newer).getByRole('option', { name: 'Term 0' })).toBeInTheDocument();
    expect(within(older).getByRole('option', { name: 'Term 0' })).toBeInTheDocument();
  });

  /** Over the typeahead threshold: both Acts' Pre-Application, 2018 fillers, and one no-Act term. */
  const longMixed: ValueOption[] = [
    ...phases,
    ...Array.from({ length: 38 }, (_, index) => ({
      value: `t${index}`,
      label: `Term ${index}`,
      legislation: '2018',
    })),
    { value: 'misc', label: 'Miscellaneous' },
  ];

  /** Holds the picks the way a column filter does, so chips and the button follow them. */
  function PickerWithState({ onChange }: { onChange: (next: string[]) => void }) {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <ValuePicker
        label="Type"
        options={longMixed}
        selected={selected}
        onChange={(next) => {
          onChange(next);
          setSelected(next);
        }}
      />
    );
  }

  it('heads the no-Act terms in the typeahead as Other terms, after both Acts', async () => {
    const user = userEvent.setup();
    renderPicker([], longMixed);

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));
    await user.click(screen.getByRole('combobox', { name: 'Search type' }));

    const listbox = screen.getByRole('listbox');
    expect(
      within(listbox)
        .getAllByRole('group')
        .map((group) => group.textContent),
    ).toEqual([
      expect.stringMatching(/^2018 Act Terms/),
      expect.stringMatching(/^2002 Act Terms/),
      expect.stringMatching(/^Other terms/),
    ]);
    const other = screen.getByRole('group', { name: 'Other terms' });
    expect(within(other).getAllByRole('option')).toHaveLength(1);
    expect(within(other).getByRole('option', { name: 'Miscellaneous' })).toBeInTheDocument();
  });

  it('drops only the 2002 term when its typeahead chip is removed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickerWithState onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Filter by Type' });

    await user.click(button);
    await user.click(screen.getByRole('combobox', { name: 'Search type' }));
    const newer = screen.getByRole('group', { name: '2018 Act Terms' });
    await user.click(within(newer).getByRole('option', { name: 'Pre-Application' }));
    const older = screen.getByRole('group', { name: '2002 Act Terms' });
    await user.click(within(older).getByRole('option', { name: 'Pre-Application' }));

    expect(button).toHaveAttribute('title', 'Pre-Application (2002), Pre-Application (2018)');

    await user.click(screen.getByRole('button', { name: 'Remove Pre-Application (2002)' }));

    expect(onChange).toHaveBeenLastCalledWith(['pre-2018']);
    expect(button).toHaveAttribute('title', 'Pre-Application (2018)');
  });
});
