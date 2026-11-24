import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPopover } from './filter-popover';

function popover(buttonText = 'All', active = false) {
  return (
    <div>
      <button type="button">Before</button>
      <FilterPopover label="Type" buttonText={buttonText} active={active} onClear={vi.fn()}>
        <label>
          <input type="checkbox" />
          Letter
        </label>
        <label>
          <input type="checkbox" />
          Report
        </label>
      </FilterPopover>
      <button type="button">After</button>
    </div>
  );
}

function renderPopover(active = false) {
  return render(popover('All', active));
}

function filterButton() {
  return screen.getByRole('button', { name: 'Filter by Type' });
}

function openGroup() {
  return screen.queryByRole('group', { name: 'Filter by Type' });
}

/** Puts the button where it is asked to be, so the popover's geometry can be asserted. */
function placeButton(top: number, bottom: number, left = 40) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom,
    left,
    right: left + 200,
    width: 200,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('FilterPopover', () => {
  it('calls the popover what it is, and names it only while it exists', async () => {
    const user = userEvent.setup();
    renderPopover();
    const button = filterButton();

    // A group of checkboxes is not a listbox, and there is nothing to control while it is shut.
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).not.toHaveAttribute('aria-controls');

    await user.click(button);

    const group = screen.getByRole('group', { name: 'Filter by Type' });
    expect(group.id).not.toBe('');
    expect(button).toHaveAttribute('aria-controls', group.id);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('heads the open popover with the column it filters, and is named by it', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());

    const group = screen.getByRole('group', { name: 'Filter by Type' });
    const head = within(group).getByText('Filter by Type');
    expect(group).toHaveAttribute('aria-labelledby', head.id);
    expect(group).not.toHaveAttribute('aria-label');
    const first = screen.getByRole('checkbox', { name: 'Letter' });
    expect(head.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens below the button when there is room', async () => {
    placeButton(120, 150);
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());

    const group = screen.getByRole('group', { name: 'Filter by Type' });
    expect(group).toHaveStyle({ top: '152px', left: '40px' });
    expect(group.style.bottom).toBe('');
  });

  it('pulls the popover in from the right edge when the button sits near it', async () => {
    vi.stubGlobal('innerWidth', 1280);
    placeButton(120, 150, 1200);
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());

    // 1280 wide, less the 232px popover and a 16px edge.
    expect(screen.getByRole('group', { name: 'Filter by Type' })).toHaveStyle({ left: '1032px' });
  });

  it('flips above the button when the space below cannot hold a usable list', async () => {
    placeButton(700, 730);
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());

    const group = screen.getByRole('group', { name: 'Filter by Type' });
    expect(group.style.bottom).toBe(`${window.innerHeight - 698}px`);
    expect(group.style.top).toBe('');
  });

  it('keeps the popover on the viewport it measured when a later render sees a different one', async () => {
    vi.stubGlobal('innerHeight', 900);
    placeButton(400, 430);
    const user = userEvent.setup();
    const { rerender } = render(popover());

    await user.click(filterButton());
    const group = screen.getByRole('group', { name: 'Filter by Type' });
    expect(group).toHaveStyle({ top: '432px' });

    // A full-page screenshot changes the viewport and fires no resize; an unrelated render must
    // not read it and take the popover off its button.
    vi.stubGlobal('innerHeight', 500);
    rerender(popover('Report', true));

    expect(screen.getByRole('button', { name: 'Clear Type' })).toBeInTheDocument();
    expect(group).toHaveStyle({ top: '432px' });
    expect(group.style.bottom).toBe('');

    // A real resize closes the popover, so the next open measures the viewport it now has.
    fireEvent(window, new Event('resize'));
    await user.click(filterButton());

    const reopened = screen.getByRole('group', { name: 'Filter by Type' });
    expect(reopened).toHaveStyle({ bottom: '102px' });
    expect(reopened.style.top).toBe('');
  });

  it('closes on Escape from inside and puts focus back on the button', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());
    await user.click(screen.getByRole('checkbox', { name: 'Letter' }));
    await user.keyboard('{Escape}');

    expect(openGroup()).not.toBeInTheDocument();
    expect(filterButton()).toHaveFocus();
  });

  it('closes when something outside is pressed', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());
    await user.click(screen.getByRole('button', { name: 'After' }));

    expect(openGroup()).not.toBeInTheDocument();
  });

  it('closes on scroll, because a fixed popover does not follow its button', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());
    fireEvent.scroll(document);

    expect(openGroup()).not.toBeInTheDocument();
  });

  it('stays open while its own list is scrolled', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());
    fireEvent.scroll(screen.getByRole('group', { name: 'Filter by Type' }));

    expect(openGroup()).toBeInTheDocument();
  });

  it('hands focus into the open popover on Tab from its button', async () => {
    const user = userEvent.setup();
    renderPopover(true);

    await user.click(filterButton());
    await user.tab();

    expect(screen.getByRole('button', { name: 'Clear Type' })).toHaveFocus();
  });

  it('goes back to the button on Shift+Tab off the first item, and stays open', async () => {
    const user = userEvent.setup();
    renderPopover(true);

    await user.click(filterButton());
    await user.tab();
    await user.tab({ shift: true });

    expect(filterButton()).toHaveFocus();
    expect(openGroup()).toBeInTheDocument();
  });

  it('closes on Tab off the last item and puts focus back on the button', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(filterButton());
    await user.click(screen.getByRole('checkbox', { name: 'Report' }));
    await user.tab();

    expect(openGroup()).not.toBeInTheDocument();
    expect(filterButton()).toHaveFocus();
  });
});
