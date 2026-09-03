import { useEffect, useId, useRef, useState } from 'react';
import { getNotifyApi } from 'app/config/config';
import { logger } from 'app/config/logging';
import './subscribe-popover.css';

const COPY = {
  project: {
    invite: 'Get an email when this project publishes an Update.',
    heading: 'Email updates for this project'
  },
  all: {
    invite: 'Get an email when any project publishes an Update.',
    heading: 'Email updates for every project'
  }
} as const;

const FAILED = 'We could not reach the subscription service. Try again in a minute.';
const INVALID = 'Enter a valid email address';

type Status = 'idle' | 'sending' | 'sent' | 'failed';

interface SubscribePopoverProps {
  /** eagle-notify service, e.g. `project:<id>` or `eao:updates`. */
  serviceName: string;
  variant: 'project' | 'all';
}

/** A section's email-updates line: what the subscription sends, then a Subscribe link whose popover
 * is the sign-up form itself, posting to eagle-notify. eagle-notify owns everything after the
 * confirmation email. Renders nothing when NOTIFY_API is unset. */
export function SubscribePopover({ serviceName, variant }: SubscribePopoverProps) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const headingId = `${baseId}-heading`;
  const emailId = `${baseId}-email`;
  const errorId = `${baseId}-error`;
  // One anchor name per instance, so two controls on a page never anchor to each other's button.
  const anchorName = `--subscribe-${baseId.replace(/[^\w-]/g, '')}`;
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const email = useRef<HTMLInputElement>(null);
  // Sent and failed never render together, so one ref covers both outcomes.
  const outcome = useRef<HTMLParagraphElement>(null);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [fieldError, setFieldError] = useState('');
  const [address, setAddress] = useState('');

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
        setStatus('idle');
        setFieldError('');
      }
    };
    element.addEventListener('toggle', onToggle);
    return () => element.removeEventListener('toggle', onToggle);
  }, []);

  // Submitting disables the focused button, and success unmounts the form, so focus would fall to <body>.
  useEffect(() => {
    if (status === 'sent' || status === 'failed') outcome.current?.focus();
  }, [status]);

  if (!getNotifyApi()) return null;

  const copy = COPY[variant];

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status === 'sending') return;

    const value = email.current?.value.trim() ?? '';
    // `noValidate` on the form, so the browser's own bubble does not pre-empt the inline message.
    if (!email.current?.checkValidity()) {
      setFieldError(INVALID);
      email.current?.focus();
      return;
    }

    setFieldError('');
    setStatus('sending');
    const form = event.currentTarget;
    const announcements = (form.elements.namedItem('announcements') as HTMLInputElement | null)?.checked;

    try {
      const response = await fetch(`${getNotifyApi()}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: value, serviceName, ...(announcements ? { announcements: true } : {}) }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.status === 202) {
        setAddress(value);
        setStatus('sent');
        return;
      }
      // eagle-notify answers 202 whether or not the address was already subscribed, so a 400 is
      // either the address or a bug in what this sends; only the first is the reader's to fix.
      const body = response.status === 400 ? await response.json().catch(() => null) : null;
      if (body?.error === 'invalid_address') {
        setStatus('idle');
        setFieldError(INVALID);
        email.current?.focus();
        return;
      }
      logger.error(`eagle-notify answered ${response.status}`, 'SubscribePopover');
      setStatus('failed');
    } catch (error) {
      logger.error('Could not reach eagle-notify', 'SubscribePopover', error);
      setStatus('failed');
    }
  }

  return (
    <div
      className="subscribe-popover"
      data-service={serviceName}
      style={{ ['--subscribe-anchor' as string]: anchorName } as React.CSSProperties}
    >
      <i className="material-icons subscribe-popover__icon" aria-hidden="true">
        email
      </i>
      <p className="subscribe-popover__invite">{copy.invite}</p>
      <button
        type="button"
        className="btn btn-primary btn-sm subscribe-popover__trigger"
        popoverTarget={panelId}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Subscribe
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
          Your personal information is collected by the Environmental Assessment Office under section 26(c) of
          the Freedom of Information and Protection of Privacy Act to send you the updates you asked for. Every
          email includes an unsubscribe link. Questions:{' '}
          <a href="mailto:EAO.EPICsystem@gov.bc.ca">EAO.EPICsystem@gov.bc.ca</a>
        </p>
        <button
          type="button"
          className="subscribe-popover__close"
          popoverTarget={panelId}
          popoverTargetAction="hide"
          aria-label="Close"
        >
          <i className="material-icons" aria-hidden="true">close</i>
        </button>

        {status === 'sent' ? (
          <div className="subscribe-popover__sent" role="status">
            <p className="subscribe-popover__sent-lead" tabIndex={-1} ref={outcome}>
              {/* The bundled Material Icons subset predates the mail-specific glyphs. */}
              <i className="material-icons" aria-hidden="true">
                check_circle
              </i>
              Check your email.
            </p>
            <p className="subscribe-popover__body">
              We sent a confirmation link to <strong>{address}</strong>. Nothing is sent until you click it.
            </p>
          </div>
        ) : (
          <form className="subscribe-popover__form" onSubmit={submit} noValidate>

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
                {FAILED}
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
