import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useScrollLock } from './use-scroll-lock';
import './modal.css';

interface ModalProps {
  /** Controlled: the dialog opens when this turns true, and closes when it turns false. */
  open: boolean;
  /** Called whenever the dialog asks to close: the X, Escape, or a press on the backdrop. */
  onClose: () => void;
  /** The heading, which is also the dialog's accessible name. */
  title: string;
  /** The close control's accessible name, where `Close` on its own reads too thin. */
  closeLabel?: string;
  /**
   * Where focus goes when the dialog closes. Unset, it returns to whatever had focus when the
   * dialog opened, which for a dialog opened by a press is the control that opened it.
   */
  restoreFocusTo?: RefObject<HTMLElement | null>;
  /** Extra class on the `<dialog>`, for a consumer's own width and content rules. */
  className?: string;
  children: ReactNode;
}

/**
 * The app's modal: a native `<dialog>` opened with `showModal()`.
 *
 * Opening it that way is the whole point. The browser then owns the focus trap, the Escape close,
 * the inert page behind it and the top-layer stacking, so no page here hand-rolls key handling and
 * there is no second trap to keep in step with the first. Stacking follows from the same place: a
 * modal opened over another lands above it and takes the Escape, so the topmost closes first, and
 * anything that is not a `<dialog>` — a menu, a popover — never competes for that key. The page
 * behind stays put, since each open modal holds the scroll lock and hands it back as it closes.
 */
export function Modal({
  open,
  onClose,
  title,
  closeLabel = 'Close',
  restoreFocusTo,
  className,
  children,
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useScrollLock(open);

  // The backdrop listener is registered once per open, so it reads the current handler through
  // this ref rather than the one the dialog opened with.
  const closing = useRef(onClose);
  useEffect(() => {
    closing.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    opener.current = (restoreFocusTo?.current ?? document.activeElement) as HTMLElement | null;
    if (!element.open) element.showModal();
    // Focus lands on the dialog rather than on its first control, so a reader hears the title
    // before the close button.
    element.focus();

    // A press that lands on the dialog element itself is a press on the backdrop: the backdrop is
    // painted by the dialog, and its presses retarget to it. A click alone isn't enough, though: a
    // drag that starts on real content (selecting text) and releases past the edge also retargets
    // to the dialog, so the press has to both start and end there.
    let pressStartedOnBackdrop = false;
    const onPointerDown = (event: PointerEvent) => {
      pressStartedOnBackdrop = event.target === element;
    };
    const onPress = (event: MouseEvent) => {
      const closeIt = pressStartedOnBackdrop && event.target === element;
      pressStartedOnBackdrop = false;
      if (closeIt) closing.current();
    };
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('click', onPress);

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('click', onPress);
      if (element.open) element.close();
      const back = opener.current;
      if (back && back.isConnected) back.focus();
    };
    // `restoreFocusTo` is read once, at the moment the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    /* eslint-disable-next-line jsx-a11y/no-redundant-roles -- the parity gate and the e2e walk resolve dialogs through a `[role="dialog"]` selector */
    <dialog
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={className ? `eagle-modal ${className}` : 'eagle-modal'}
      onClose={onClose}
    >
      <div className="eagle-modal__head">
        <h2 id={titleId} className="eagle-modal__title">
          {title}
        </h2>
        <button
          type="button"
          className="eagle-modal__close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <i className="material-icons" aria-hidden="true">
            close
          </i>
        </button>
      </div>

      <div className="eagle-modal__body">{children}</div>
    </dialog>
  );
}
