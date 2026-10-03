import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadConfig } from 'app/config/config';
import { logger } from 'app/config/logging';
import { useSubscribe } from './use-subscribe';

const user = userEvent.setup();

/** The smallest form a caller could build on the hook, showing its state as text. */
function Harness({ extra }: { extra?: Record<string, unknown> }) {
  const { configured, email, status, fieldError, address, submit } = useSubscribe(
    'eao:updates',
    'Harness',
  );
  if (!configured) return <p>unconfigured</p>;
  return (
    <form onSubmit={(event) => submit(event, extra)} noValidate>
      <label htmlFor="address">Email address</label>
      <input ref={email} id="address" type="email" required />
      <button type="submit">Go</button>
      <p data-testid="status">{status}</p>
      <p data-testid="field-error">{fieldError}</p>
      <p data-testid="address">{address}</p>
    </form>
  );
}

async function renderHarness(notifyApi: string, extra?: Record<string, unknown>) {
  window.__env = { logLevel: 4, NOTIFY_API: notifyApi };
  await loadConfig();
  render(<Harness extra={extra} />);
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function submitAs(address: string) {
  await user.type(screen.getByLabelText('Email address'), address);
  await user.click(screen.getByRole('button', { name: 'Go' }));
}

describe('useSubscribe', () => {
  const originalEnv = window.__env;

  afterEach(async () => {
    window.__env = originalEnv;
    await loadConfig();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports unconfigured when NOTIFY_API is empty', async () => {
    await renderHarness('');

    expect(screen.getByText('unconfigured')).toBeInTheDocument();
  });

  it('posts the address, service and extra fields, with a timeout', async () => {
    const fetchMock = stubFetch(json(202, { status: 'pending_confirmation' }));
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await renderHarness('/notify-api', { announcements: true });

    await submitAs('  reader@example.com ');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/notify-api/api/subscriptions');
    expect(JSON.parse(init?.body as string)).toEqual({
      address: 'reader@example.com',
      serviceName: 'eao:updates',
      announcements: true,
    });
    // A hung eagle-notify must end in the failed message, not a button stuck on sending.
    expect(timeout).toHaveBeenCalledWith(10000);
    expect(init?.signal).toBe(timeout.mock.results[0].value);
  });

  it('turns a 202 into sent, keeping the address', async () => {
    stubFetch(json(202, { status: 'pending_confirmation' }));
    await renderHarness('/notify-api');

    await submitAs('reader@example.com');

    expect(await screen.findByText('sent')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('reader@example.com');
  });

  it('stops at the field check without a request when the address is malformed', async () => {
    const fetchMock = stubFetch(json(202, {}));
    await renderHarness('/notify-api');

    await submitAs('not-an-address');

    expect(screen.getByTestId('field-error')).toHaveTextContent('Enter a valid email address');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns an invalid_address 400 into a field error, not a failure', async () => {
    stubFetch(json(400, { error: 'invalid_address' }));
    await renderHarness('/notify-api');

    await submitAs('reader@example');

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
  });

  it('turns any other 400 into failed and logs it under the caller', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    stubFetch(json(400, { error: 'unknown_service' }));
    await renderHarness('/notify-api');

    await submitAs('reader@example.com');

    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(error.mock.calls[0][1]).toBe('Harness');
  });

  it('turns a network error into failed', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    stubFetch(new TypeError('network down'));
    await renderHarness('/notify-api');

    await submitAs('reader@example.com');

    expect(await screen.findByText('failed')).toBeInTheDocument();
  });
});
