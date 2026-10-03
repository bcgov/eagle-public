import { useId, useState } from 'react';
import { Modal } from 'app/components/modal/modal';
import { CollectionNoticeText, SubscribeSent } from './subscribe-parts';
import { SUBSCRIBE_FAILED, useSubscribe } from './use-subscribe';
import './subscribe-dialog.css';

/**
 * The site-wide "All Updates" sign-up: a Subscribe to updates button and the dialog it opens.
 * Posting `eao:updates` makes eagle-notify add the broader EAO announcements itself, so the form
 * has no choices to offer. Renders nothing when NOTIFY_API is unset.
 */
export function SubscribeDialog() {
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const errorId = `${baseId}-error`;
  const [open, setOpen] = useState(false);
  const { configured, email, outcome, status, fieldError, address, submit, reset } = useSubscribe(
    'eao:updates',
    'SubscribeDialog',
  );

  if (!configured) return null;

  function close(): void {
    setOpen(false);
    reset();
  }

  return (
    <>
      <button
        type="button"
        className="subscribe-dialog__trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <i className="material-icons" aria-hidden="true">
          notifications_none
        </i>
        Subscribe to updates
      </button>

      <Modal open={open} onClose={close} title="Subscribe to updates" className="subscribe-dialog">
        <p className="subscribe-dialog__subtitle">Environmental Assessment Office</p>

        {/* eagle-notify answers 202 for an address that is already subscribed too, so both get
            this panel: a different answer would tell anyone which addresses are on the list. */}
        {status === 'sent' ? (
          <>
            <div className="subscribe-dialog__scroll">
              <SubscribeSent address={address} leadRef={outcome} />
            </div>
            <div className="subscribe-dialog__foot">
              <button type="button" className="subscribe-dialog__primary" onClick={close}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form className="subscribe-dialog__form" onSubmit={(event) => submit(event)} noValidate>
            <div className="subscribe-dialog__scroll">
              <div>
                <label className="subscribe-dialog__label" htmlFor={emailId}>
                  Email address
                </label>
                <input
                  ref={email}
                  id={emailId}
                  name="address"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="subscribe-dialog__input"
                  aria-invalid={fieldError ? 'true' : undefined}
                  aria-describedby={errorId}
                />
                <p id={errorId} className="subscribe-popover__error" role="alert">
                  {fieldError}
                </p>
              </div>
              <p className="subscribe-dialog__note">
                You get Updates from every project, and broader EAO announcements are included. To
                follow one project only, use Subscribe on that project's page.
              </p>
              <div className="subscribe-dialog__notice">
                <p className="subscribe-dialog__notice-title">Collection notice</p>
                <p className="subscribe-dialog__note">
                  <CollectionNoticeText />
                </p>
              </div>
              {status === 'failed' && (
                <p className="subscribe-popover__failed" role="alert" tabIndex={-1} ref={outcome}>
                  {SUBSCRIBE_FAILED}
                </p>
              )}
            </div>
            <div className="subscribe-dialog__foot">
              <button type="button" className="subscribe-dialog__secondary" onClick={close}>
                Cancel
              </button>
              <button
                type="submit"
                className="subscribe-dialog__primary"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
