import { useRef, useState, type RefObject } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedTour } from './guided-tour';
import { TOUR_STEPS } from './tour-steps';

const ALL = TOUR_STEPS.map((step) => step.target);

/** A page with one stand-in control per `data-tour` key, and a button that starts the tour. */
function Host({ targets = ALL, narrows = [] }: { targets?: string[]; narrows?: string[] }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [late, setLate] = useState<string[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  return (
    <div>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>
        Take the tour
      </button>
      {/* Stands in for a control that only arrives once the first search has answered. */}
      <button type="button" onClick={() => setLate(['scope'])}>
        answer the search
      </button>
      {/* Stands in for the re-render a breakpoint brings: controls leave the page. */}
      <button type="button" onClick={() => setGone(narrows)}>
        narrow the page
      </button>
      {[...targets, ...late.filter((target) => !targets.includes(target))]
        .filter((target) => !gone.includes(target))
        .map((target) => (
          <div key={target} data-tour={target}>
            {target}
          </div>
        ))}
      <GuidedTour
        open={open}
        onEnd={() => setOpen(false)}
        restoreFocusTo={trigger as RefObject<HTMLElement | null>}
      />
    </div>
  );
}

function card(): HTMLElement | null {
  return screen.queryByRole('dialog');
}

function counter(): string {
  return screen.getByText(/^Step \d+ of \d+$/).textContent ?? '';
}

async function start(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Take the tour' }));
  return user;
}

/** The tour recounts a frame after the page changes, so a change has to be given that frame. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

/**
 * A ResizeObserver that reports the first size the way a browser does: one callback per `observe`.
 * Capped, so a tour that keeps re-subscribing is counted rather than left to spin.
 */
function observingResizeObserver(cap = 20): { observes: number } {
  const seen = { observes: 0 };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      readonly callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe = () => {
        seen.observes += 1;
        if (seen.observes <= cap) this.callback();
      };
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  );
  return seen;
}

/** jsdom lays nothing out, so a target only has a box if it is told to have one. */
function boxOf(target: string, top: number, height: number): void {
  const element = document.querySelector(`[data-tour="${target}"]`) as HTMLElement;
  element.getBoundingClientRect = () =>
    ({ top, left: 40, width: 200, height, bottom: top + height, right: 240 }) as DOMRect;
}

describe('GuidedTour', () => {
  /** jsdom has no scrolling of its own, and the tour scrolls a target that is out of view. */
  const scrolled = vi.fn();
  const realScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
  /** Where the stand-in page is scrolled to, so `window.scrollY` answers what `scrollTo` did. */
  let scrollPosition = 0;
  /** jsdom lets an inert element take focus; a browser refuses, which is what the tour's
      restore order turns on, so the refusal is stood in here. */
  const realFocus = HTMLElement.prototype.focus;
  beforeEach(() => {
    scrollPosition = 0;
    scrolled.mockImplementation((_left: number, top: number) => {
      scrollPosition = top;
    });
    vi.stubGlobal('scrollTo', scrolled);
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollPosition });
    HTMLElement.prototype.focus = function refusedWhenInert(this: HTMLElement, options?) {
      if (this.closest('[inert]')) return;
      realFocus.call(this, options);
    };
  });
  afterEach(() => {
    if (realScrollY) Object.defineProperty(window, 'scrollY', realScrollY);
    HTMLElement.prototype.focus = realFocus;
    vi.unstubAllGlobals();
    scrolled.mockReset();
  });

  it('walks the steps in order and counts them', async () => {
    render(<Host />);
    const user = await start();

    expect(counter()).toBe('Step 1 of 7');
    expect(screen.getByRole('heading', { name: 'One search box' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(counter()).toBe('Step 2 of 7');
    expect(screen.getByRole('heading', { name: 'Pick a record type' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(counter()).toBe('Step 1 of 7');
    expect(screen.getByRole('heading', { name: 'One search box' })).toBeInTheDocument();
  });

  it('skips a step the page has no control for, and counts what is left', async () => {
    render(<Host targets={ALL.filter((target) => target !== 'scope')} />);
    const user = await start();

    expect(counter()).toBe('Step 1 of 6');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(counter()).toBe('Step 3 of 6');
    expect(screen.getByRole('heading', { name: 'Filter by column' })).toBeInTheDocument();
  });

  it('picks up a control that only arrives after it started, and recounts', async () => {
    render(<Host targets={ALL.filter((target) => target !== 'scope')} />);
    const user = await start();
    expect(counter()).toBe('Step 1 of 6');

    await user.click(screen.getByRole('button', { name: 'answer the search' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(counter()).toBe('Step 2 of 7');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(counter()).toBe('Step 3 of 7');
    expect(
      screen.getByRole('heading', { name: 'Two ways to search documents' }),
    ).toBeInTheDocument();
  });

  it('speaks each step, because focus stays where it already was', async () => {
    render(<Host />);
    const user = await start();
    const spoken = () => screen.getByText(/^Step \d+ of \d+\. /).textContent;

    expect(spoken()).toBe('Step 1 of 7. One search box');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(spoken()).toBe('Step 2 of 7. Pick a record type');
  });

  it('names the card by its title and describes it by its body', async () => {
    render(<Host />);
    await start();

    expect(card()).toHaveAccessibleName('One search box');
    expect(card()).toHaveAccessibleDescription(TOUR_STEPS[0].body);
  });

  it('makes the page behind it inert, and hands it back at the end', async () => {
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Take the tour' });
    const user = await start();

    expect(trigger).toHaveAttribute('inert');
    expect(document.querySelector('[data-tour="types"]')).toHaveAttribute('inert');
    // The card is the one thing the tour is for: it never goes inert, nor does anything it draws.
    expect(card()).not.toHaveAttribute('inert');
    expect(document.querySelectorAll('.display-grid__tour [inert]')).toHaveLength(0);
    // The lit control is the hole in the dim, and stays pressable.
    expect(document.querySelector('[data-tour="search"]')).not.toHaveAttribute('inert');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(document.querySelector('[data-tour="search"]')).toHaveAttribute('inert');
    expect(document.querySelector('[data-tour="types"]')).not.toHaveAttribute('inert');

    await user.click(screen.getByRole('button', { name: 'Skip tour' }));

    expect(trigger).not.toHaveAttribute('inert');
    expect(document.querySelector('[data-tour="search"]')).not.toHaveAttribute('inert');
  });

  it('hands the page back when it unmounts mid-tour', async () => {
    const view = render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Take the tour' });
    await start();
    expect(trigger).toHaveAttribute('inert');

    view.unmount();

    expect(trigger).not.toHaveAttribute('inert');
  });

  it('keeps focus on the card across every move', async () => {
    render(<Host />);
    const user = await start();
    expect(card()).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(card()).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(card()).toHaveFocus();
  });

  it('offers Done on the last step and ends there', async () => {
    render(<Host targets={['search', 'copy']} />);
    const user = await start();

    expect(counter()).toBe('Step 1 of 2');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(counter()).toBe('Step 2 of 2');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(card()).not.toBeInTheDocument();
  });

  it('holds the page still while it runs and releases it at the end', async () => {
    render(<Host />);
    const user = await start();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    await user.click(screen.getByRole('button', { name: 'Skip tour' }));

    expect(card()).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Take the tour' })).toHaveFocus();
  });

  it('ends on Escape and hands focus back to the trigger', async () => {
    render(<Host />);
    const user = await start();
    expect(card()).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(card()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take the tour' })).toHaveFocus();
  });

  it('measures the spotlight again when the window resizes', async () => {
    render(<Host />);
    await start();
    // The card sits under the control it points at, so where it is says where the ring is.
    expect(card()).toHaveStyle({ top: '12px' });

    boxOf('search', 300, 40);
    fireEvent(window, new Event('resize'));

    expect(card()).toHaveStyle({ top: '352px' });
  });

  it('places the card against the viewport it measured, not the one a later render sees', async () => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 900);
    const { rerender } = render(<Host />);
    boxOf('search', 300, 40);
    await start();
    expect(card()).toHaveStyle({ top: '352px', left: '40px', width: '380px' });

    // Chromium swaps the viewport out to take a full-page shot and fires no resize. The ring is
    // drawn off the stored measurement, so the card has to be too, or the two part company.
    vi.stubGlobal('innerWidth', 300);
    vi.stubGlobal('innerHeight', 400);
    rerender(<Host />);

    expect(card()).toHaveStyle({ top: '352px', left: '40px', width: '380px' });
    expect(card()?.style.bottom).toBe('');

    fireEvent(window, new Event('resize'));

    expect(card()).toHaveStyle({ bottom: '112px', left: '20px', width: '268px' });
    expect(card()?.style.top).toBe('');
  });

  it('keeps the reader on the same control when an earlier one goes away', async () => {
    render(<Host narrows={['filterrow']} />);
    const user = await start();
    for (const _step of [2, 3, 4, 5]) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(counter()).toBe('Step 5 of 7');
    expect(
      screen.getByRole('heading', { name: 'Filters that are not columns' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'narrow the page' }));
    await settle();

    expect(counter()).toBe('Step 4 of 6');
    expect(
      screen.getByRole('heading', { name: 'Filters that are not columns' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(counter()).toBe('Step 5 of 6');
    expect(screen.getByRole('heading', { name: 'Choose your columns' })).toBeInTheDocument();
  });

  it('lands on the next control along when the one being read about goes away', async () => {
    render(<Host narrows={['more']} />);
    const user = await start();
    for (const _step of [2, 3, 4, 5]) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(counter()).toBe('Step 5 of 7');

    await user.click(screen.getByRole('button', { name: 'narrow the page' }));
    await settle();

    expect(counter()).toBe('Step 5 of 6');
    expect(screen.getByRole('heading', { name: 'Choose your columns' })).toBeInTheDocument();
  });

  it('counts from one when every control before the current one goes away', async () => {
    render(<Host narrows={['search', 'types']} />);
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(counter()).toBe('Step 3 of 7');

    await user.click(screen.getByRole('button', { name: 'narrow the page' }));
    await settle();

    expect(counter()).toBe('Step 1 of 5');
    expect(
      screen.getByRole('heading', { name: 'Two ways to search documents' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('subscribes once per step, because an unchanged page is not rewritten', async () => {
    const observer = observingResizeObserver();
    render(<Host />);
    const user = await start();
    expect(counter()).toBe('Step 1 of 7');
    // A browser answers `observe` with the size it already has. Rewriting a step list that has
    // not changed re-subscribes on that answer, and the tour never stops re-reading the page.
    expect(observer.observes).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(counter()).toBe('Step 2 of 7');
    expect(observer.observes).toBe(2);
  });

  it('leaves focus where the reader put it when a read finds nothing moved', async () => {
    render(<Host />);
    await start();
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();

    fireEvent(window, new Event('resize'));

    expect(next).toHaveFocus();
  });

  it('brings a target below the fold into view before it measures', async () => {
    render(<Host />);
    boxOf('search', 900, 40);

    await start();

    // 140px of clearance above the control, measured after the scroll rather than before it.
    expect(scrolled).toHaveBeenCalledWith(0, 760);
  });

  it('leaves the pinned page where it is when a resize reflows the target', async () => {
    render(<Host />);
    boxOf('search', 900, 40);
    await start();
    expect(scrolled).toHaveBeenCalledWith(0, 760);
    scrolled.mockClear();

    // Chromium squeezes the viewport to 1x1 to take a full-page shot, which reflows the page
    // under the tour, then puts the viewport back.
    boxOf('search', 20, 40);
    vi.stubGlobal('innerWidth', 1);
    vi.stubGlobal('innerHeight', 1);
    fireEvent(window, new Event('resize'));
    boxOf('search', 140, 40);
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 900);
    fireEvent(window, new Event('resize'));

    expect(scrolled).not.toHaveBeenCalled();
  });

  it('puts the page back on its pin when a resize scrolls it away', async () => {
    render(<Host />);
    boxOf('search', 900, 40);
    await start();
    scrolled.mockClear();

    // A 1x1 viewport has next to nothing to scroll, so the browser clamps the page to the top.
    scrollPosition = 0;
    boxOf('search', 400, 40);
    vi.stubGlobal('innerHeight', 1);
    fireEvent(window, new Event('resize'));

    expect(scrolled.mock.calls).toEqual([[0, 760]]);
  });

  it('ends without drawing anything when the page has no control it knows about', async () => {
    render(<Host targets={[]} />);
    await start();

    expect(card()).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });
});
