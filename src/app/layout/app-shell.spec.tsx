import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderAt } from '../../test-utils';
import { routes } from 'app/routes';
import { page } from 'app/analytics/analytics';
import type { InitialEntry } from 'react-router';
import { AppShell, SCROLL_KEYS_CAP, SCROLL_KEYS_STORAGE_KEY } from './app-shell';

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

  describe('scroll on navigation', () => {
    const scrollTo = vi.fn();

    beforeEach(() => {
      scrollTo.mockClear();
      vi.stubGlobal('scrollTo', scrollTo);
      sessionStorage.clear();
    });

    afterEach(() => {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    /** A project page with two tabs, and a second page, under the real shell. */
    function renderPages(entries: InitialEntry[] = ['/p/1/overview'], initialIndex?: number) {
      return renderAt(
        entries,
        [
          {
            path: '/',
            element: <AppShell />,
            children: [
              {
                path: 'p/:projId',
                children: [
                  { path: 'overview', element: <h1>Overview</h1> },
                  { path: 'engagement', element: <h1>Engagement</h1> },
                ],
              },
              { path: 'p/:projId/cp/:cpId/details', element: <h1>Comment period</h1> },
            ],
          },
        ],
        { initialIndex },
      );
    }

    function scrolledTo(y: number) {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    }

    function scrolledDown() {
      scrolledTo(900);
    }

    function savedScrollKeys(): [string, string][] {
      return JSON.parse(sessionStorage.getItem(SCROLL_KEYS_STORAGE_KEY) ?? '[]');
    }

    it('opens a page already visited at the top when a link leads back to it', async () => {
      const { router } = renderPages();
      await screen.findByRole('heading', { name: 'Overview' });
      scrolledDown();
      await router.navigate('/p/1/cp/2/details');
      await screen.findByRole('heading', { name: 'Comment period' });
      scrolledTo(0);

      await router.navigate('/p/1/overview');

      await screen.findByRole('heading', { name: 'Overview' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    });

    it('restores the old position on browser back', async () => {
      const { router } = renderPages();
      await screen.findByRole('heading', { name: 'Overview' });
      scrolledDown();
      await router.navigate('/p/1/cp/2/details');
      await screen.findByRole('heading', { name: 'Comment period' });
      scrolledTo(200);

      await router.navigate(-1);

      await screen.findByRole('heading', { name: 'Overview' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 900);
    });

    it('restores the old position on browser back to a tab reached within the page', async () => {
      const { router } = renderPages();
      await screen.findByRole('heading', { name: 'Overview' });
      await router.navigate('/p/1/engagement');
      await screen.findByRole('heading', { name: 'Engagement' });
      scrolledDown();
      await router.navigate('/p/1/cp/2/details');
      await screen.findByRole('heading', { name: 'Comment period' });
      scrolledTo(200);

      await router.navigate(-1);

      await screen.findByRole('heading', { name: 'Engagement' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 900);
    });

    it('opens a new page at the top', async () => {
      const { router } = renderPages();
      await screen.findByRole('heading', { name: 'Overview' });
      scrolledDown();

      await router.navigate('/p/1/cp/2/details');

      await screen.findByRole('heading', { name: 'Comment period' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    });

    it('keeps the reader in place on a tab change within the same page', async () => {
      const { router } = renderPages();
      await screen.findByRole('heading', { name: 'Overview' });
      scrolledDown();

      await router.navigate('/p/1/engagement');

      await screen.findByRole('heading', { name: 'Engagement' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 900);
    });

    it('opens a freshly loaded page at the top, not at a position stored for an earlier load', async () => {
      // A typed URL, bookmark or outside link loads with entry key 'default', as the last load did.
      sessionStorage.setItem(
        SCROLL_KEYS_STORAGE_KEY,
        JSON.stringify([['default', '/p/9#default']]),
      );
      sessionStorage.setItem(
        'react-router-scroll-positions',
        JSON.stringify({ '/p/9#default': 900 }),
      );

      renderPages([{ pathname: '/p/1/overview', key: 'default' }], 0);

      await screen.findByRole('heading', { name: 'Overview' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    });

    it('restores the old position on browser back to a tab reached within the page after a reload', async () => {
      const first = renderPages();
      await screen.findByRole('heading', { name: 'Overview' });
      const overviewKey = first.router.state.location.key;
      await first.router.navigate('/p/1/engagement');
      await screen.findByRole('heading', { name: 'Engagement' });
      const engagementKey = first.router.state.location.key;
      scrolledDown();
      await first.router.navigate('/p/1/cp/2/details');
      await screen.findByRole('heading', { name: 'Comment period' });
      const detailsKey = first.router.state.location.key;
      scrolledTo(200);
      window.dispatchEvent(new Event('pagehide'));
      first.unmount();

      // A reload keeps the tab's history entries and their keys, but not the app's memory.
      const { router } = renderPages(
        [
          { pathname: '/p/1/overview', key: overviewKey },
          { pathname: '/p/1/engagement', key: engagementKey },
          { pathname: '/p/1/cp/2/details', key: detailsKey },
        ],
        2,
      );
      await screen.findByRole('heading', { name: 'Comment period' });
      await router.navigate(-1);

      await screen.findByRole('heading', { name: 'Engagement' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 900);
    });

    it('keeps the reader in place on a tab change when session storage throws', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const { router } = renderPages();
      await screen.findByRole('heading', { name: 'Overview' });
      scrolledDown();

      await router.navigate('/p/1/engagement');

      await screen.findByRole('heading', { name: 'Engagement' });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 900);
    });

    it(`keeps at most ${SCROLL_KEYS_CAP} saved history entries, dropping the oldest`, async () => {
      const seeded = Array.from({ length: SCROLL_KEYS_CAP }, (_, i): [string, string] => [
        `old${i}`,
        `/p/1#old${i}`,
      ]);
      sessionStorage.setItem(SCROLL_KEYS_STORAGE_KEY, JSON.stringify(seeded));

      const { router } = renderPages();

      await screen.findByRole('heading', { name: 'Overview' });
      const saved = savedScrollKeys();
      expect(saved).toHaveLength(SCROLL_KEYS_CAP);
      const entries = saved.map(([entry]) => entry);
      expect(entries).not.toContain('old0');
      expect(entries).toContain('old1');
      expect(entries).toContain(router.state.location.key);
    });
  });
});
