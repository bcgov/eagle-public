import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The curtain must never open on its own: prod sends ACCESS_GATE false, and a wrong password must
 * leave the app hidden. Only a 2xx from eagle-api counts as unlocked.
 */
const URL = '/api/public/gate';

let fetchMock: ReturnType<typeof vi.fn>;

/** Fresh module graph per test — the unlocked flag is read from sessionStorage once, at load. */
async function loadWith(env: Record<string, unknown>) {
  vi.resetModules();
  window.__env = { logLevel: 4, ...env };
  const { loadConfig } = await import('app/config/config');
  await loadConfig();
  return import('./gate');
}

function responding(status: number, statusText = ''): Response {
  return new Response(null, { status, statusText });
}

beforeEach(() => {
  sessionStorage.clear();
  fetchMock = vi.fn(async () => responding(204, 'No Content'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('the curtain', () => {
  async function renderShell(env: Record<string, unknown>) {
    await loadWith(env);
    const [{ routes }, { RouterProvider, createMemoryRouter }, { QueryClient, QueryClientProvider }] =
      await Promise.all([
        import('app/routes'),
        import('react-router'),
        import('@tanstack/react-query')
      ]);
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  }

  it('is open when the flag is absent', async () => {
    await renderShell({});
    expect(await screen.findByText('EPIC')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('is open when the flag is false', async () => {
    await renderShell({ ACCESS_GATE: false });
    expect(await screen.findByText('EPIC')).toBeInTheDocument();
  });

  it('is open for a value that is merely truthy', async () => {
    await renderShell({ ACCESS_GATE: 'true' });
    expect(await screen.findByText('EPIC')).toBeInTheDocument();
  });

  it('replaces the whole shell when the flag is true', async () => {
    await renderShell({ ACCESS_GATE: true });
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
    expect(document.querySelector('.app-header')).toBe(null);
    expect(screen.queryByText('Admin Login')).not.toBeInTheDocument();
    expect(document.querySelector('.app-footer')).toBe(null);
    expect(document.querySelector('.toast-container')).toBe(null);
  });

  it('stays open for a session that already unlocked', async () => {
    sessionStorage.setItem('eagle-gate', '1');
    await renderShell({ ACCESS_GATE: true });
    expect(await screen.findByText('EPIC')).toBeInTheDocument();
  });
});

describe('the password form', () => {
  async function renderGate() {
    const { Gate } = await loadWith({ ACCESS_GATE: true });
    render(<Gate />);
  }

  async function submit(password: string): Promise<void> {
    await userEvent.type(screen.getByLabelText('Password'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  }

  function error(): HTMLElement | null {
    return document.getElementById('gate-error');
  }

  it('renders a focused password field and no error', async () => {
    await renderGate();
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input).toHaveFocus();
    expect(error()).toBe(null);
  });

  it('posts the typed password and remembers the session', async () => {
    await renderGate();
    await submit('hunter2');

    expect(fetchMock).toHaveBeenCalledWith(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'hunter2' })
    });
    expect(error()).toBe(null);
    expect(sessionStorage.getItem('eagle-gate')).toBe('1');
  });

  it('shows "Incorrect password" on 401 and stays locked', async () => {
    fetchMock.mockResolvedValue(responding(401, 'Unauthorized'));
    await renderGate();
    await submit('wrong');

    expect(error()).toHaveTextContent('Incorrect password');
    expect(error()).toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'gate-error');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(sessionStorage.getItem('eagle-gate')).toBe(null);
  });

  it('shows a generic error when the check itself fails', async () => {
    fetchMock.mockResolvedValue(responding(404, 'Not Found'));
    await renderGate();
    await submit('anything');

    expect(error()).toHaveTextContent('Could not check the password');
    expect(sessionStorage.getItem('eagle-gate')).toBe(null);
  });

  it('disables the button while the check is in flight', async () => {
    let release: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>(resolve => { release = resolve; }));
    await renderGate();

    await submit('hunter2');
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();

    release(responding(204, 'No Content'));
    await vi.waitFor(() => expect(button).toBeEnabled());
  });
});
