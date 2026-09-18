import { useRef, useState, type RefObject } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './modal';

/**
 * jsdom has no top layer. `src/test-setup.ts` stands in for `showModal` by setting the `open`
 * attribute, so the page behind an open modal keeps every one of its controls in the tab ring and
 * the browser's own trap cannot be seen from here.
 *
 * This stands in for the containment half of modality, the way the standard describes it: while a
 * modal is open, nothing outside it is reachable. It hangs off `showModal`, so a dialog opened any
 * other way — `show()`, or a div wearing `role="dialog"` — gets no containment and the Tab test
 * below fails. That is the point of it: what this repo's code controls is whether it asks for
 * modality, and the trap itself is the browser's. `e2e/` walks the real one.
 */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

function standInForTopLayer(): () => void {
  const stack: HTMLDialogElement[] = [];
  const parked = new Map<Element, string | null>();
  const nativeShowModal = HTMLDialogElement.prototype.showModal;
  const nativeClose = HTMLDialogElement.prototype.close;

  function apply(): void {
    parked.forEach((prior, element) => {
      if (prior === null) element.removeAttribute('tabindex');
      else element.setAttribute('tabindex', prior);
    });
    parked.clear();
    const top = stack.filter((modal) => modal.open).at(-1);
    if (!top) return;
    document.querySelectorAll(FOCUSABLE).forEach((element) => {
      if (element === top || top.contains(element)) return;
      parked.set(element, element.getAttribute('tabindex'));
      element.setAttribute('tabindex', '-1');
    });
  }

  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    nativeShowModal.call(this);
    stack.push(this);
    apply();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, value?: string) {
    nativeClose.call(this, value);
    const at = stack.indexOf(this);
    if (at >= 0) stack.splice(at, 1);
    apply();
  };

  return () => {
    HTMLDialogElement.prototype.showModal = nativeShowModal;
    HTMLDialogElement.prototype.close = nativeClose;
  };
}

/**
 * The page around the modal: a control that opens it, so focus starts somewhere real and the
 * restore has a destination, and a second modal the first one can open on top of itself.
 */
function Host({
  onClose = () => undefined,
  restoreFocusTo,
}: {
  onClose?: () => void;
  restoreFocusTo?: RefObject<HTMLElement | null>;
}) {
  const [details, setDetails] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setDetails(true)}>
        Open details
      </button>
      <Modal
        open={details}
        onClose={() => {
          setDetails(false);
          onClose();
        }}
        title="Details"
        restoreFocusTo={restoreFocusTo}
      >
        <button type="button" onClick={() => setConfirm(true)}>
          Confirm something
        </button>
      </Modal>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Confirm">
        <p>Are you sure?</p>
      </Modal>
    </>
  );
}

function Elsewhere() {
  const somewhere = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={somewhere}>
        Back to the list
      </button>
      <Host restoreFocusTo={somewhere as RefObject<HTMLElement | null>} />
    </>
  );
}

/**
 * The dialog carrying `title`, open or closed. Found through its heading rather than through the
 * dialog's accessible name, because a closed dialog is hidden and a hidden heading names nothing.
 */
function modal(title: string): HTMLDialogElement {
  return screen.getByRole('heading', { hidden: true, name: title }).closest('dialog')!;
}

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: 'Open details' });
}

async function open(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(trigger());
  return user;
}

describe('Modal', () => {
  let removeStandIn: () => void;

  beforeEach(() => {
    removeStandIn = standInForTopLayer();
  });

  afterEach(() => {
    removeStandIn();
  });

  it('opens as a modal and puts focus on the dialog, ahead of its controls', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<Host />);

    await open();

    expect(showModal).toHaveBeenCalled();
    expect(modal('Details')).toHaveAttribute('open');
    expect(modal('Details')).toHaveAttribute('aria-modal', 'true');
    expect(modal('Details')).toHaveFocus();
  });

  it('carries a consumer className on the dialog, alongside the modal class', () => {
    render(
      <Modal open onClose={() => undefined} title="Details" className="details-modal">
        <p>content</p>
      </Modal>,
    );

    expect(modal('Details')).toHaveClass('eagle-modal', 'details-modal');
  });

  it('keeps Tab inside the dialog and comes back around to its first control', async () => {
    render(<Host />);
    const user = await open();
    const close = within(modal('Details')).getByRole('button', { name: 'Close' });

    await user.tab();
    expect(close).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Confirm something' })).toHaveFocus();

    // Past the last control, the page behind is out of the ring rather than next in it.
    await user.tab();
    expect(trigger()).not.toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    const user = await open();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
    expect(modal('Details')).not.toHaveAttribute('open');
  });

  it('closes on the close button', async () => {
    render(<Host />);
    const user = await open();

    await user.click(within(modal('Details')).getByRole('button', { name: 'Close' }));

    expect(modal('Details')).not.toHaveAttribute('open');
  });

  it('closes on a press on the backdrop, and stays open for a press inside it', async () => {
    render(<Host />);
    const user = await open();

    await user.click(screen.getByRole('heading', { name: 'Details' }));
    expect(modal('Details')).toHaveAttribute('open');

    // A press that lands on the dialog element itself is a press on the backdrop.
    await user.click(modal('Details'));
    expect(modal('Details')).not.toHaveAttribute('open');
  });

  it('stays open for a press that starts inside the body and releases on the backdrop', async () => {
    render(<Host />);
    await open();
    const inner = within(modal('Details')).getByRole('button', { name: 'Confirm something' });

    // A drag that starts on real content (e.g. selecting text) and releases past its edge
    // retargets its click to the dialog, the same as a genuine backdrop press. Only the latter
    // should close it.
    fireEvent.pointerDown(inner);
    fireEvent.click(modal('Details'));

    expect(modal('Details')).toHaveAttribute('open');
  });

  it('hands focus back to the control that opened it', async () => {
    render(<Host />);
    const user = await open();

    await user.keyboard('{Escape}');

    expect(trigger()).toHaveFocus();
  });

  it('hands focus to `restoreFocusTo` instead, when one is given', async () => {
    render(<Elsewhere />);
    const user = await open();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Back to the list' })).toHaveFocus();
  });

  it('holds the page still while it is open, and lets it go on close', async () => {
    render(<Host />);
    const user = await open();

    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    expect(document.documentElement).toHaveStyle({ overflow: 'hidden' });

    await user.keyboard('{Escape}');

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('stacks, and Escape closes the topmost one first', async () => {
    render(<Host />);
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Confirm something' }));
    expect(modal('Confirm')).toHaveAttribute('open');

    await user.keyboard('{Escape}');

    expect(modal('Confirm')).not.toHaveAttribute('open');
    expect(modal('Details')).toHaveAttribute('open');
  });

  it('leaves the page held by the modal still open underneath', async () => {
    render(<Host />);
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Confirm something' }));

    await user.keyboard('{Escape}');

    expect(document.body).toHaveStyle({ overflow: 'hidden' });
  });
});
