import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('offers no Clear while nothing is picked', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Filter by Type' }));

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
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
