import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadConfig } from 'app/config/config';
import { logger } from 'app/config/logging';
import { SubscribeDialog } from './subscribe-dialog';

/**
 * jsdom has no `<dialog>` behaviour of its own (test-setup.ts shims `showModal`), so the focus
 * trap and the top layer are the browser's to prove; this covers what the form does.
 */
const user = userEvent.setup();

async function renderDialog(notifyApi = '/notify-api') {
  window.__env = { logLevel: 4, NOTIFY_API: notifyApi };
  await loadConfig();
  render(<SubscribeDialog />);
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

const trigger = () => screen.getByRole('button', { name: 'Subscribe to updates' });

async function subscribeAs(address: string) {
  await user.click(trigger());
  const dialog = screen.getByRole('dialog', { name: 'Subscribe to updates' });
  await user.type(within(dialog).getByLabelText('Email address'), address);
  await user.click(within(dialog).getByRole('button', { name: 'Subscribe' }));
  return dialog;
}

describe('subscribe dialog', () => {
  const originalEnv = window.__env;

  afterEach(async () => {
    window.__env = originalEnv;
    await loadConfig();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders no button when NOTIFY_API is empty', async () => {
    await renderDialog('');

    expect(screen.queryByRole('button', { name: 'Subscribe to updates' })).toBeNull();
  });

  it('opens from a button that says it opens a dialog', async () => {
    await renderDialog();

    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(trigger());
    const dialog = screen.getByRole('dialog', { name: 'Subscribe to updates' });
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByText(/broader EAO announcements are included/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'EAO.EPICsystem@gov.bc.ca' })).toBeVisible();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
  });

  it('subscribes the address to every project’s Updates', async () => {
    const fetchMock = stubFetch(json(202, { status: 'pending_confirmation' }));
    await renderDialog();

    await subscribeAs('reader@example.com');

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toEqual({ address: 'reader@example.com', serviceName: 'eao:updates' });
  });

  it('names the address in a status panel that takes focus once sent', async () => {
    stubFetch(json(202, { status: 'pending_confirmation' }));
    await renderDialog();

    const dialog = await subscribeAs('reader@example.com');

    const status = await within(dialog).findByRole('status');
    expect(status).toHaveTextContent('Check your email.');
    expect(status).toHaveTextContent('reader@example.com');
    expect(status).toContainElement(document.activeElement as HTMLElement);
    expect(within(dialog).queryByRole('button', { name: 'Subscribe' })).toBeNull();
  });

  it('keeps the form and marks the field when eagle-notify rejects the address', async () => {
    stubFetch(json(400, { error: 'invalid_address' }));
    await renderDialog();

    const dialog = await subscribeAs('reader@example');

    const error = await within(dialog).findByText('Enter a valid email address');
    const input = within(dialog).getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    expect(within(dialog).getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
  });

  it('keeps the form open with an alert when the request fails', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    stubFetch(new TypeError('network down'));
    await renderDialog();

    const dialog = await subscribeAs('reader@example.com');

    const alert = await within(dialog).findByText(
      'We could not reach the subscription service. Try again in a minute.',
    );
    expect(alert).toHaveAttribute('role', 'alert');
    expect(document.activeElement).toBe(alert);
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByLabelText('Email address')).toHaveValue('reader@example.com');
  });

  it('closes on Cancel and hands focus back to the button', async () => {
    await renderDialog();

    await user.click(trigger());
    const dialog = screen.getByRole('dialog', { name: 'Subscribe to updates' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(dialog).not.toHaveAttribute('open');
    expect(trigger()).toHaveFocus();
  });

  it('reopens on an empty form after a sent address', async () => {
    stubFetch(json(202, { status: 'pending_confirmation' }));
    await renderDialog();

    const dialog = await subscribeAs('reader@example.com');
    await within(dialog).findByRole('status');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await user.click(trigger());

    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(within(dialog).getByLabelText('Email address')).toHaveValue('');
  });
});
