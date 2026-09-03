import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadConfig } from 'app/config/config';
import { logger } from 'app/config/logging';
import { SubscribePopover } from './subscribe-popover';

/** jsdom never opens a popover, so its contents stay `display: none`: every query passes
 * `hidden: true` and every interaction skips the pointer-events check. */
const user = userEvent.setup({ pointerEventsCheck: 0 });

async function renderControl(notifyApi: string, props: Parameters<typeof SubscribePopover>[0]) {
  window.__env = { logLevel: 4, NOTIFY_API: notifyApi };
  await loadConfig();
  render(<SubscribePopover {...props} />);
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const ACCEPTED = () => json(202, { status: 'pending_confirmation' });

async function signUpAs(address: string) {
  await user.type(screen.getByLabelText('Email address', { selector: 'input' }), address);
  await user.click(screen.getByRole('button', { name: 'Sign up', hidden: true }));
}

describe('subscribe popover', () => {
  const originalEnv = window.__env;

  afterEach(async () => {
    window.__env = originalEnv;
    await loadConfig();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders nothing when NOTIFY_API is empty', async () => {
    await renderControl('', { serviceName: 'eao:updates', variant: 'all' });

    expect(screen.queryByRole('button', { name: /Subscribe/ })).toBeNull();
    expect(document.querySelector('.subscribe-popover')).toBeNull();
  });

  it('wires the button to the popover it labels', async () => {
    await renderControl('/notify-api', { serviceName: 'project:proj-1', variant: 'project' });

    const trigger = screen.getByRole('button', { name: 'Subscribe' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    const panel = document.getElementById(trigger.getAttribute('popovertarget') ?? '');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('popover', 'auto');
    expect(panel).toHaveAttribute('role', 'dialog');
    // The dialog takes its name from the heading it points at.
    expect(document.getElementById(panel!.getAttribute('aria-labelledby') ?? '')).toBe(
      screen.getByRole('heading', { name: 'Email updates for this project', hidden: true })
    );
    expect(screen.getByRole('button', { name: 'Close', hidden: true })).toHaveAttribute('popovertargetaction', 'hide');
    // Chromium synthesises no expanded state for a popovertarget invoker, so the component owns it.
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('explains the project subscription and offers the announcements opt-in', async () => {
    await renderControl('/notify-api', { serviceName: 'project:proj-1', variant: 'project' });

    // The banner the section shows carries the promise; the panel repeats none of it.
    expect(screen.getByText('Get an email when this project publishes an Update.')).toBeInTheDocument();
    // The collection notice is required text; it sits under the title in every state.
    expect(screen.getByText(/Freedom of Information and Protection of Privacy Act/, { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Also send me EAO announcements that are not about a single project',
        hidden: true
      })
    ).toBeInTheDocument();
  });

  /** The all-projects service already carries announcements, so there is nothing to opt into. */
  it('explains the all-projects subscription and offers no announcements opt-in', async () => {
    await renderControl('/notify-api', { serviceName: 'eao:updates', variant: 'all' });

    expect(screen.getByText('Get an email when any project publishes an Update.')).toBeInTheDocument();
    // Signing up here already covers announcements, so there is no checkbox to offer.
    expect(screen.queryByRole('checkbox', { hidden: true })).toBeNull();
  });

  it('posts the address and service to eagle-notify', async () => {
    const fetchMock = stubFetch(ACCEPTED());
    await renderControl('/notify-api', { serviceName: 'project:proj-1', variant: 'project' });

    await signUpAs('reader@example.com');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/notify-api/api/subscriptions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ address: 'reader@example.com', serviceName: 'project:proj-1' });
  });

  /** eagle-notify only treats a literal `true` as consent, so the key is sent only when ticked. */
  it('asks for announcements only when the box is ticked', async () => {
    const fetchMock = stubFetch(ACCEPTED());
    await renderControl('/notify-api', { serviceName: 'project:proj-1', variant: 'project' });

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Also send me EAO announcements that are not about a single project',
        hidden: true
      })
    );
    await signUpAs('reader@example.com');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      address: 'reader@example.com',
      serviceName: 'project:proj-1',
      announcements: true
    });
  });

  it('replaces the form with the confirmation notice on 202', async () => {
    stubFetch(ACCEPTED());
    await renderControl('/notify-api', { serviceName: 'eao:updates', variant: 'all' });

    await signUpAs('reader@example.com');

    expect(await screen.findByText('Check your email.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent until you click it\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign up', hidden: true })).toBeNull();
    // The submit button unmounts with the form, so the notice has to claim focus itself.
    expect(document.querySelector('.subscribe-popover__sent')).toContainElement(
      document.activeElement as HTMLElement
    );
  });

  it('shows a field error when eagle-notify rejects the address', async () => {
    const fetchMock = stubFetch(json(400, { error: 'invalid_address' }));
    await renderControl('/notify-api', { serviceName: 'eao:updates', variant: 'all' });

    // `reader@example` passes the browser's own email check, so this is eagle-notify's verdict.
    await signUpAs('reader@example');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const error = await screen.findByText('Enter a valid email address');
    const input = screen.getByLabelText('Email address', { selector: 'input' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    // The form stays put, so the reader can correct the address they already typed.
    expect(screen.getByRole('button', { name: 'Sign up', hidden: true })).toBeInTheDocument();
  });

  it('says the service is unreachable when the request fails', async () => {
    stubFetch(new TypeError('network down'));
    await renderControl('/notify-api', { serviceName: 'eao:updates', variant: 'all' });

    await signUpAs('reader@example.com');

    const alert = await screen.findByText('We could not reach the subscription service. Try again in a minute.');
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up', hidden: true })).toBeInTheDocument();
    // The submit button is disabled mid-flight, so focus would otherwise land on <body>.
    expect(document.activeElement).toBe(alert);
  });

  /** A dead eagle-notify is invisible without this: the reader sees a message, nobody else does. */
  it('logs through the repo logger when the request fails', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    stubFetch(new TypeError('network down'));
    await renderControl('/notify-api', { serviceName: 'eao:updates', variant: 'all' });

    await signUpAs('reader@example.com');

    await screen.findByText('We could not reach the subscription service. Try again in a minute.');
    expect(error).toHaveBeenCalledTimes(1);
    const [message, source] = error.mock.calls[0];
    expect(source).toBe('SubscribePopover');
    // The address is personal information; it belongs in the request, not in telemetry.
    expect(message).not.toContain('reader@example.com');
  });
});
