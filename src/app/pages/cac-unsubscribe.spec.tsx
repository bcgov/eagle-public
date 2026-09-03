import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../test-utils';
import { CacUnsubscribe } from './cac-unsubscribe';

interface Sent {
  url: string;
  init?: RequestInit;
}

function okResponse() {
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
}

/** `hold` leaves the request pending until the returned `release` is called. */
function renderUnsubscribe(path: string, { hold = false } = {}) {
  const sent: Sent[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), init });
      if (hold) {
        await pending;
      }
      return okResponse();
    }),
  );

  const { router } = renderAt(path, [
    { path: '/', element: <h1>Home</h1> },
    { path: '/*', Component: CacUnsubscribe },
  ]);
  return { sent, router, release };
}

describe('cac-unsubscribe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the emailed matrix parameters', () => {
    renderUnsubscribe('/cac-unsubscribe;project=Site%20C;projectId=abc123;email=me@example.com');

    expect(screen.getByText('Site C')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveValue('me@example.com');
  });

  it('reads query string parameters too', () => {
    renderUnsubscribe('/cac-unsubscribe?project=Site+C&projectId=abc123&email=me@example.com');

    expect(screen.getByText('Site C')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveValue('me@example.com');
  });

  it('PUTs the email to cacRemoveMember and reports success', async () => {
    const { sent } = renderUnsubscribe(
      '/cac-unsubscribe;project=Site%20C;projectId=abc123;email=me@example.com',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/project/abc123/cacRemoveMember');
    expect(sent[0].init?.method).toBe('PUT');
    expect(JSON.parse(String(sent[0].init?.body))).toEqual({
      email: 'me@example.com',
      projId: 'abc123',
    });

    expect(await screen.findByText(/You have been unsubscribed successfully/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unsubscribe' })).not.toBeInTheDocument();
  });

  it('disables Unsubscribe while the request is in flight, and re-enables it after', async () => {
    const { release } = renderUnsubscribe(
      '/cac-unsubscribe;project=Site%20C;projectId=abc123;email=me@example.com',
      { hold: true },
    );
    const button = screen.getByRole('button', { name: 'Unsubscribe' });

    await userEvent.click(button);
    expect(button).toBeDisabled();

    release();
    expect(await screen.findByText(/You have been unsubscribed successfully/)).toBeInTheDocument();
  });

  it('re-enables Unsubscribe when the request fails', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    renderAt('/cac-unsubscribe;projectId=abc123;email=me@example.com', [
      { path: '/*', Component: CacUnsubscribe },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeEnabled());
  });

  it('sends the visitor home on cancel', async () => {
    const { router } = renderUnsubscribe('/cac-unsubscribe;projectId=abc123;email=me@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(router.state.location.pathname).toBe('/');
  });
});
