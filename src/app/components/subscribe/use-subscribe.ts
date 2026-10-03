import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getNotifyApi } from 'app/config/config';
import { logger } from 'app/config/logging';

export const SUBSCRIBE_FAILED =
  'We could not reach the subscription service. Try again in a minute.';
export const SUBSCRIBE_INVALID = 'Enter a valid email address';

export type SubscribeStatus = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * The sign-up request to eagle-notify, shared by every subscribe form. The caller renders the
 * form; `email` goes on its address input and `outcome` on the sent or failed message, which
 * takes focus when it appears. `configured` is false when NOTIFY_API is unset, and the caller
 * then renders nothing.
 *
 * `source` names the caller in the log, so a failure says which form it came from.
 */
export function useSubscribe(serviceName: string, source: string) {
  const email = useRef<HTMLInputElement>(null);
  // Sent and failed never render together, so one ref covers both outcomes.
  const outcome = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<SubscribeStatus>('idle');
  const [fieldError, setFieldError] = useState('');
  const [address, setAddress] = useState('');

  // Submitting disables the focused button, and success unmounts the form, so focus would fall to <body>.
  useEffect(() => {
    if (status === 'sent' || status === 'failed') outcome.current?.focus();
  }, [status]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    event.preventDefault();
    if (status === 'sending') return;

    const value = email.current?.value.trim() ?? '';
    // `noValidate` on the form, so the browser's own bubble does not pre-empt the inline message.
    if (!email.current?.checkValidity()) {
      setFieldError(SUBSCRIBE_INVALID);
      email.current?.focus();
      return;
    }

    setFieldError('');
    setStatus('sending');

    try {
      const response = await fetch(`${getNotifyApi()}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: value, serviceName, ...extra }),
        signal: AbortSignal.timeout(10000),
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
        setFieldError(SUBSCRIBE_INVALID);
        email.current?.focus();
        return;
      }
      logger.error(`eagle-notify answered ${response.status}`, source);
      setStatus('failed');
    } catch (error) {
      logger.error('Could not reach eagle-notify', source, error);
      setStatus('failed');
    }
  }

  /** Back to an empty form, so a reopened form never shows the last address's outcome. */
  function reset(): void {
    setStatus('idle');
    setFieldError('');
  }

  return {
    configured: Boolean(getNotifyApi()),
    email,
    outcome,
    status,
    fieldError,
    address,
    submit,
    reset,
  };
}
