import { type RefObject } from 'react';
import { Link } from 'react-router';
import { Modal } from 'app/components/modal/modal';
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
 * The dialog itself is `Modal`, so the focus trap, Escape and the `aria-modal` semantics are the
 * browser's rather than ours. The long-form page at `/search-help` keeps the folder-structure
 * lists this summary links out to.
 */
export function SearchHelpDialog({
  open,
  onClose,
  onStartTour,
  restoreFocusTo,
}: SearchHelpDialogProps) {
  return (
    /* The wrapper draws nothing. It carries the shared z-index scale and the `data-help` state
       hook the parity gate resolves the dialog through. */
    <div className="display-grid__overlay" data-help={open ? '1' : '0'}>
      <Modal
        open={open}
        onClose={onClose}
        title="Search help"
        closeLabel="Close search help"
        restoreFocusTo={restoreFocusTo}
        className="display-grid__help"
      >
        <h3 className="display-grid__help-heading">Quotes</h3>
        <p className="display-grid__help-text">
          Search parameters in quotes are searched as a whole phrase rather than as individual
          words. Searching Certificate Extension returns content containing either word; searching{' '}
          <strong>“Certificate Extension”</strong> searches for that phrase exactly as you typed it.
          Upper and lower case count. Strings of parameters can be combined:{' '}
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
      </Modal>
    </div>
  );
}
