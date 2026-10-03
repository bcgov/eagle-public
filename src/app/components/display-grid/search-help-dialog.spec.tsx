import { useRef, useState, type RefObject } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SearchHelpDialog } from './search-help-dialog';

/**
 * The page around the dialog: a link that opens it, so focus starts somewhere real and the
 * restore has a destination. jsdom has no `<dialog>` behaviour of its own — the focus trap and
 * the top layer are the browser's, and `e2e/tests/search.spec.ts` is what proves them.
 */
function Host({
  onClose = () => undefined,
  onStartTour = () => undefined,
}: {
  onClose?: () => void;
  onStartTour?: () => void;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <a
        ref={link}
        href="/search-help"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        Search help
      </a>
      <SearchHelpDialog
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        onStartTour={() => {
          setOpen(false);
          onStartTour();
        }}
        restoreFocusTo={link as RefObject<HTMLElement | null>}
      />
    </MemoryRouter>
  );
}

function dialog(): HTMLDialogElement {
  return screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
}

async function open(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('link', { name: 'Search help' }));
  return user;
}

describe('SearchHelpDialog', () => {
  it('opens as a modal, takes focus, and locks the page behind it', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<Host />);

    await open();

    expect(showModal).toHaveBeenCalled();
    expect(dialog()).toHaveAttribute('open');
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(dialog()).toHaveFocus();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    expect(screen.getByRole('heading', { name: 'Quotes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hyphens' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Advanced search help' })).toHaveAttribute(
      'href',
      '/search-help',
    );
  });

  it('closes on Escape, releases the page and hands focus back to the opener', async () => {
    render(<Host />);
    const user = await open();

    await user.keyboard('{Escape}');

    expect(dialog()).not.toHaveAttribute('open');
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('link', { name: 'Search help' })).toHaveFocus();
  });

  it('closes on a press on the backdrop, and stays open for a press inside it', async () => {
    render(<Host />);
    const user = await open();

    await user.click(screen.getByRole('heading', { name: 'Search help' }));
    expect(dialog()).toHaveAttribute('open');

    // A press that lands on the dialog element itself is a press on the backdrop.
    await user.click(dialog());
    expect(dialog()).not.toHaveAttribute('open');
  });

  it('closes on the close button', async () => {
    render(<Host />);
    const user = await open();

    await user.click(screen.getByRole('button', { name: 'Close search help' }));

    expect(dialog()).not.toHaveAttribute('open');
  });

  it('hands the tour off and closes itself', async () => {
    const onStartTour = vi.fn();
    render(<Host onStartTour={onStartTour} />);
    const user = await open();

    await user.click(screen.getByRole('button', { name: 'Take the tour' }));

    expect(onStartTour).toHaveBeenCalled();
    expect(dialog()).not.toHaveAttribute('open');
    expect(document.body.style.overflow).toBe('');
  });
});
