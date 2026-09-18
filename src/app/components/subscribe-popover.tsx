import { useEffect, useId, useRef, useState } from 'react';
import { CollectionNoticeText, SubscribeSent } from './subscribe/subscribe-parts';
import { SUBSCRIBE_FAILED, useSubscribe } from './subscribe/use-subscribe';
import './subscribe-popover.css';

const COPY = {
  project: {
    invite: 'Get an email when this project publishes an Update.',
    heading: 'Email updates for this project',
  },
  all: {
    invite: 'Get an email when any project publishes an Update.',
    heading: 'Email updates for every project',
  },
} as const;

interface SubscribePopoverProps {
  /** eagle-notify service, e.g. `project:<id>` or `eao:updates`. */
  serviceName: string;
  variant: 'project' | 'all';
  /** `masthead` drops the band for the blue banner's action; `card` drops it for a full-width
   * primary button inside a tinted card. */
  surface?: 'band' | 'masthead' | 'card';
  /** Trigger text; the surface's default when unset. */
  label?: string;
}

/** A section's email-updates line: what the subscription sends, then a Subscribe link whose popover
 * is the sign-up form itself, posting to eagle-notify. eagle-notify owns everything after the
 * confirmation email. Renders nothing when NOTIFY_API is unset. */
export function SubscribePopover({
  serviceName,
  variant,
  surface = 'band',
  label,
}: SubscribePopoverProps) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const headingId = `${baseId}-heading`;
  const emailId = `${baseId}-email`;
  const errorId = `${baseId}-error`;
  // One anchor name per instance, so two controls on a page never anchor to each other's button.
  const anchorName = `--subscribe-${baseId.replace(/[^\w-]/g, '')}`;
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { configured, email, outcome, status, fieldError, address, submit, reset } = useSubscribe(
    serviceName,
    'SubscribePopover',
  );

  const [open, setOpen] = useState(false);

  // Opening a popover leaves focus on the trigger, so a keyboard reader would tab past the panel.
  // Closing resets, so a reopened panel never shows the last address's confirmation notice.
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const onToggle = (event: Event) => {
      const opening = (event as ToggleEvent).newState === 'open';
      setOpen(opening);
      if (opening) {
        heading.current?.focus();
      } else {
        reset();
      }
    };
    element.addEventListener('toggle', onToggle);
    return () => element.removeEventListener('toggle', onToggle);
    // `reset` only sets state, so the listener registered on mount stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!configured) return null;

  const copy = COPY[variant];

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    const announcements = (
      event.currentTarget.elements.namedItem('announcements') as HTMLInputElement | null
    )?.checked;
    void submit(event, announcements ? { announcements: true } : undefined);
  }

  const masthead = surface === 'masthead';
  const band = surface === 'band';

  return (
    <div
      className={`subscribe-popover${band ? '' : ` subscribe-popover--${surface}`}`}
      data-service={serviceName}
      style={{ ['--subscribe-anchor' as string]: anchorName } as React.CSSProperties}
    >
      {band && (
        <>
          <i className="material-icons subscribe-popover__icon" aria-hidden="true">
            email
          </i>
          <p className="subscribe-popover__invite">{copy.invite}</p>
        </>
      )}
      <button
        type="button"
        className={
          band
            ? 'btn btn-primary btn-sm subscribe-popover__trigger'
            : `subscribe-popover__trigger subscribe-popover__trigger--${surface}`
        }
        popoverTarget={panelId}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {masthead && (
          <i className="material-icons" aria-hidden="true">
            notifications_none
          </i>
        )}
        {label ?? (band ? 'Subscribe' : 'Subscribe to updates')}
      </button>
      <div
        id={panelId}
        ref={panel}
        popover="auto"
        role="dialog"
        aria-labelledby={headingId}
        className="subscribe-popover__panel"
      >
        <h2 id={headingId} className="subscribe-popover__heading" tabIndex={-1} ref={heading}>
          {copy.heading}
        </h2>
        <p className="subscribe-popover__privacy">
          <CollectionNoticeText />
        </p>
        <button
          type="button"
          className="subscribe-popover__close"
          popoverTarget={panelId}
          popoverTargetAction="hide"
          aria-label="Close"
        >
          <i className="material-icons" aria-hidden="true">
            close
          </i>
        </button>

        {status === 'sent' ? (
          <SubscribeSent address={address} leadRef={outcome} />
        ) : (
          <form className="subscribe-popover__form" onSubmit={onSubmit} noValidate>
            <div className="form-group">
              <label className="control-label" htmlFor={emailId}>
                Email address
              </label>
              <input
                ref={email}
                id={emailId}
                name="address"
                type="email"
                required
                autoComplete="email"
                className={`form-control${fieldError ? ' is-invalid' : ''}`}
                aria-invalid={fieldError ? 'true' : undefined}
                aria-describedby={errorId}
              />
              <p id={errorId} className="subscribe-popover__error" role="alert">
                {fieldError}
              </p>
            </div>

            {variant === 'project' && (
              <div className="subscribe-popover__check">
                <input type="checkbox" id={`${baseId}-announcements`} name="announcements" />
                <label htmlFor={`${baseId}-announcements`}>
                  Also send me EAO announcements that are not about a single project
                </label>
              </div>
            )}

            {status === 'failed' && (
              <p className="subscribe-popover__failed" role="alert" tabIndex={-1} ref={outcome}>
                {SUBSCRIBE_FAILED}
              </p>
            )}

            <div className="subscribe-popover__actions">
              <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                {status === 'sending' ? 'Signing up…' : 'Sign up'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
