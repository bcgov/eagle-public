import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderAt } from '../../test-utils';
import { routes } from 'app/routes';
import { page } from 'app/analytics/analytics';

vi.mock('app/analytics/analytics', () => ({ page: vi.fn() }));

describe('app shell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );
    vi.mocked(page).mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  function renderShell() {
    return renderAt('/', routes);
  }

  it('renders the header, home page and footer at /', async () => {
    renderShell();

    // Header and footer content is covered by their own specs; the shell owes the landmarks.
    expect(await screen.findByRole('banner')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Environmental Assessments' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('contentinfo')).toBeInTheDocument();
  });

  it('skips to the main landmark', async () => {
    renderShell();

    const skip = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(document.querySelector('main#main-content')).not.toBeNull();
  });

  it('posts one Page Viewed on mount and one per navigation, even under StrictMode', async () => {
    const { router } = renderAt('/', routes, { wrapper: StrictMode });

    await screen.findByText('EPIC');
    // StrictMode remounts effects once on mount in dev; the ref guard must absorb that.
    expect(page).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledWith('Home', { path: '/' });

    await router.navigate('/contact');

    await waitFor(() => expect(page).toHaveBeenCalledTimes(2));
    expect(page).toHaveBeenLastCalledWith('Contact', { path: '/contact' });
  });
});
