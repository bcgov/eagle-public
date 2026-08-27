import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { CacUnsubscribe } from './cac-unsubscribe';

interface Sent { url: string; init?: RequestInit }

function renderAt(path: string) {
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), init });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    })
  );

  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Home</h1> },
      { path: '/*', Component: CacUnsubscribe }
    ],
    { initialEntries: [path] }
  );
  render(<RouterProvider router={router} />);
  return { sent, router };
}

describe('cac-unsubscribe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the emailed matrix parameters', () => {
    renderAt('/cac-unsubscribe;project=Site%20C;projectId=abc123;email=me@example.com');

    expect(screen.getByText('Site C')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveValue('me@example.com');
  });

  it('reads query string parameters too', () => {
    renderAt('/cac-unsubscribe?project=Site+C&projectId=abc123&email=me@example.com');

    expect(screen.getByText('Site C')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveValue('me@example.com');
  });

  it('PUTs the email to cacRemoveMember and reports success', async () => {
    const { sent } = renderAt('/cac-unsubscribe;project=Site%20C;projectId=abc123;email=me@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/project/abc123/cacRemoveMember');
    expect(sent[0].init?.method).toBe('PUT');
    expect(JSON.parse(String(sent[0].init?.body))).toEqual({ email: 'me@example.com', projId: 'abc123' });

    expect(await screen.findByText(/You have been unsubscribed successfully/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unsubscribe' })).not.toBeInTheDocument();
  });

  it('sends the visitor home on cancel', async () => {
    const { router } = renderAt('/cac-unsubscribe;projectId=abc123;email=me@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(router.state.location.pathname).toBe('/');
  });
});
