import { useEffect, useId, useRef, type RefObject } from 'react';
import { Link } from 'react-router';
import { useScrollLock } from './use-scroll-lock';
import './search-help-dialog.css';

interface SearchHelpDialogProps {
  open: boolean;
  /** Called whenever the dialog closes: the X, Escape, a backdrop press, or Take the tour. */
  onClose: () => void;
  onStartTour: () => void;
  /**
   * Where focus goes when the dialog closes. Unset, it returns to whatever had focus when the
   * dialog opened, which for a dialog opened by a press is the control that opened it.
   */
  restoreFocusTo?: RefObject<HTMLElement | null>;
}

/**
 * The search-syntax help, as a modal.
 *
 * A native `<dialog>` opened with `showModal()`, so the focus trap, Escape and the `aria-modal`
 * semantics are the browser's rather than ours. The long-form page at `/search-help` keeps the
 * folder-structure lists this summary links out to.
 */
export function SearchHelpDialog({
  open,
  onClose,
  onStartTour,
  restoreFocusTo,
}: SearchHelpDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useScrollLock(open);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    opener.current = (restoreFocusTo?.current ?? document.activeElement) as HTMLElement | null;
    if (!element.open) element.showModal();
    // The prototype puts focus on the dialog rather than on its first control, so a reader hears
    // the title before the close button.
    element.focus();

    // A press that lands on the dialog element itself is a press on the backdrop: the backdrop is
    // painted by the dialog, and its presses retarget to it.
    const onPress = (event: MouseEvent) => {
      if (event.target === element) onClose();
    };
    element.addEventListener('click', onPress);

    return () => {
      element.removeEventListener('click', onPress);
      if (element.open) element.close();
      const back = opener.current;
      if (back && back.isConnected) back.focus();
    };
    // `restoreFocusTo` is read once, at the moment the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="display-grid__overlay" data-help={open ? '1' : '0'}>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- the parity gate and the e2e walk resolve this dialog through a `[role="dialog"]` selector */}
      <dialog
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="display-grid__help"
        onClose={onClose}
      >
        <div className="display-grid__help-head">
          <h2 id={titleId} className="display-grid__help-title">
            Search help
          </h2>
          <button
            type="button"
            className="display-grid__help-close"
            aria-label="Close search help"
            onClick={onClose}
          >
            <i className="material-icons" aria-hidden="true">
              close
            </i>
          </button>
        </div>

        <div className="display-grid__help-body">
          <h3 className="display-grid__help-heading">Quotes</h3>
          <p className="display-grid__help-text">
            Search parameters in quotes are searched as a whole phrase rather than as individual
            words. Searching Certificate Extension returns content containing either word; searching{' '}
            <strong>“Certificate Extension”</strong> searches for that phrase exactly as you typed
            it. Upper and lower case count. Strings of parameters can be combined:{' '}
            <strong>“Certificate Extension” “2013”</strong> returns only certificate extensions that
            occurred in 2013.
          </p>

          <h3 className="display-grid__help-heading">Hyphens</h3>
          <p className="display-grid__help-text">
            A hyphen removes results that include the words which follow it — an ignore or except
            button. <strong>Application -Information Requirements</strong> searches for the word
            Application but removes any result with the words Information Requirements. Combine it
            with quotes to narrow further:{' '}
            <strong>Application -Information Requirements “2013”</strong>.
          </p>

          <p className="display-grid__help-start">
            <button type="button" className="display-grid__help-tour" onClick={onStartTour}>
              <i className="material-icons" aria-hidden="true">
                play_circle_outline
              </i>
              Take the tour
            </button>
          </p>

          <p className="display-grid__help-more">
            <Link to="/search-help">Advanced search help</Link>
            <span className="display-grid__help-aside">
              {' '}
              — including how to search by the folder structure used on the previous site.
            </span>
          </p>
        </div>
      </dialog>
    </div>
  );
}
