import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from 'app/routes';

describe('app shell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  });

  afterEach(() => vi.unstubAllGlobals());

  function renderShell() {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  }

  it('renders the header, home page and footer at /', async () => {
    renderShell();

    expect(await screen.findByText('EPIC')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Environmental Assessments' })).toBeInTheDocument();
    expect(await screen.findByText('Admin Login')).toBeInTheDocument();
  });

  it('skips to the main landmark', async () => {
    renderShell();

    const skip = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(document.querySelector('main#main-content')).not.toBeNull();
  });

  // The nav used to be driven by bootstrap.bundle.min.js; these two cover what replaced it.
  it('opens and closes the mobile nav from the toggler', async () => {
    renderShell();

    const toggler = await screen.findByRole('button', { name: 'Toggle navigation' });
    expect(document.getElementById('mainNav')).not.toHaveClass('show');

    await userEvent.click(toggler);
    expect(document.getElementById('mainNav')).toHaveClass('show');

    await userEvent.click(toggler);
    expect(document.getElementById('mainNav')).not.toHaveClass('show');
  });

  it('opens one nav dropdown at a time', async () => {
    renderShell();

    const projectInfo = await screen.findByRole('button', { name: /Project Information/ });
    const eaProcess = screen.getByRole('button', { name: /The EA Process/ });

    await userEvent.click(projectInfo);
    expect(projectInfo).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(eaProcess);
    expect(projectInfo).toHaveAttribute('aria-expanded', 'false');
    expect(eaProcess).toHaveAttribute('aria-expanded', 'true');
  });
});
