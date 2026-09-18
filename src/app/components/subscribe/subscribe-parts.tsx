import type { Ref } from 'react';
import 'app/components/subscribe-popover.css';

/** The FOIPPA collection notice every subscribe form carries. */
export function CollectionNoticeText() {
  return (
    <>
      Your personal information is collected by the Environmental Assessment Office under section
      26(c) of the Freedom of Information and Protection of Privacy Act to send you the updates you
      asked for. Every email includes an unsubscribe link. Questions:{' '}
      <a href="mailto:EAO.EPICsystem@gov.bc.ca">EAO.EPICsystem@gov.bc.ca</a>
    </>
  );
}

/** What a subscribe form becomes once eagle-notify accepts the address. `leadRef` takes focus. */
export function SubscribeSent({
  address,
  leadRef,
}: {
  address: string;
  leadRef: Ref<HTMLParagraphElement>;
}) {
  return (
    <div className="subscribe-popover__sent" role="status">
      <p className="subscribe-popover__sent-lead" tabIndex={-1} ref={leadRef}>
        {/* The bundled Material Icons subset predates the mail-specific glyphs. */}
        <i className="material-icons" aria-hidden="true">
          check_circle
        </i>
        Check your email.
      </p>
      <p className="subscribe-popover__body">
        We sent a confirmation link to <strong>{address}</strong>. Nothing is sent until you click
        it.
      </p>
    </div>
  );
}
