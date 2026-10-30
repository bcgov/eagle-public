import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SiteHeader } from './site-header';
import { loadConfig, type EnvConfig } from 'app/config/config';

/** The masthead alone, on a router, so a spec can drive the route without the whole app. */
function renderHeader(path = '/') {
  const router = createMemoryRouter([{ path: '*', element: <SiteHeader /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

function toggler() {
  return screen.getByRole('button', { name: 'Menu' });
}

function nav() {
  return screen.getByRole('navigation', { name: 'Main' });
}

type MediaChangeListener = (event: MediaQueryListEvent) => void;

/**
 * jsdom has no viewport, so the header's 768px listener is driven by hand: install before render,
 * then `cross(true)` is the window widening past the breakpoint.
 */
function stubDesktopQuery() {
  const listeners = new Set<MediaChangeListener>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: MediaChangeListener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: MediaChangeListener) =>
        listeners.delete(listener),
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;

  return {
    cross: (matches: boolean) =>
      act(() => {
        listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
      }),
    restore: () => {
      window.matchMedia = original;
    },
  };
}

describe('site header', () => {
  it('sends logo and site name home through one link named for the site', () => {
    renderHeader('/search');

    const header = screen.getByRole('banner');
    const home = within(header)
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/');
    expect(home).toHaveLength(1);
    expect(home[0]).toHaveAccessibleName('EAO Project Information Centre');

    // The mark is decorative: the title alone names the link.
    expect(within(home[0]).queryByRole('img')).not.toBeInTheDocument();
    const logo = within(home[0]).getByRole('presentation');
    expect(logo).toHaveAttribute('src', '/assets/images/BCID_H_rgb_rev_header.png');
  });

  it('lists the three masthead destinations in order', () => {
    renderHeader();

    const links = within(nav()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/projects',
      '/search',
      '/about',
    ]);
    expect(links.map((link) => link.textContent)).toEqual(['Map Explorer', 'Search', 'About']);
  });

  it('marks Search as the current page anywhere on the search page', () => {
    renderHeader('/search?record=activities');

    const search = within(nav()).getByRole('link', { name: 'Search' });
    expect(search).toHaveAttribute('aria-current', 'page');
    // The record type is a query param, so every tab of the page keeps the item lit.
    expect(within(nav()).getByRole('link', { name: 'Map Explorer' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('marks the link for the page being viewed', () => {
    renderHeader('/about');

    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Search' })).not.toHaveAttribute('aria-current');
  });

  describe('the environment banner', () => {
    const originalEnv = window.__env;

    /** The runtime config the banner reads, loaded the way the app loads it at startup. */
    async function configureWith(values: EnvConfig): Promise<void> {
      window.__env = { logLevel: 4, ...values };
      await loadConfig();
    }

    afterEach(async () => {
      window.__env = originalEnv;
      await loadConfig();
    });

    it('names the environment above the bar', () => {
      renderHeader();

      const header = screen.getByRole('banner');
      expect(within(header).getByText(/This is the/).textContent).toContain('local');
    });

    it('stays hidden on a deployed environment with no colour set', async () => {
      await configureWith({ ENVIRONMENT: 'test', BANNER_COLOUR: 'no-banner-colour-set' });
      renderHeader();

      expect(screen.queryByText(/This is the/)).not.toBeInTheDocument();
    });

    it('shows locally even with no colour set, because local is never the real site', async () => {
      await configureWith({ ENVIRONMENT: 'local', BANNER_COLOUR: '' });
      renderHeader();

      const header = screen.getByRole('banner');
      expect(within(header).getByText(/This is the/).textContent).toContain('local');
    });
  });

  // The map page's filter bar is fixed against this variable (pages/projects/projlist-filters.css).
  describe('its height for the map page', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      document.documentElement.style.removeProperty('--header-total-height');
    });

    /** Captures the observer the header creates, so a spec can resize the header by hand. */
    function mockResizeObserver() {
      const callbacks: (() => void)[] = [];
      const disconnect = vi.fn();
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: () => void) {
            callbacks.push(callback);
          }
          observe = () => undefined;
          unobserve = () => undefined;
          disconnect = disconnect;
        },
      );
      return { fire: () => act(() => callbacks.forEach((callback) => callback())), disconnect };
    }

    function headerHeightVar() {
      return document.documentElement.style.getPropertyValue('--header-total-height');
    }

    it('is published on mount', () => {
      renderHeader();

      // jsdom has no layout, so offsetHeight is 0.
      expect(headerHeightVar()).toBe('0px');
    });

    it('follows the header when it changes size, not just the window', () => {
      const observer = mockResizeObserver();
      renderHeader();

      Object.defineProperty(screen.getByRole('banner'), 'offsetHeight', {
        configurable: true,
        value: 97,
      });
      observer.fire();

      expect(headerHeightVar()).toBe('97px');
    });

    it('stops watching once the header unmounts', () => {
      const observer = mockResizeObserver();
      renderHeader();

      cleanup();

      expect(observer.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('the mobile panel', () => {
    it('is named Menu without printing the word beside the glyph', () => {
      renderHeader();

      expect(toggler()).toHaveAccessibleName('Menu');
      // The bar shows the hamburger alone; the ligature text inside it is lowercase `menu`.
      expect(screen.queryByText('Menu')).not.toBeInTheDocument();
    });

    it('opens and closes from the toggler', async () => {
      const user = userEvent.setup();
      renderHeader();

      expect(toggler()).toHaveAttribute('aria-controls', nav().id);
      expect(toggler()).toHaveAttribute('aria-expanded', 'false');
      expect(nav()).not.toHaveClass('eao-header__nav--open');

      await user.click(toggler());
      expect(toggler()).toHaveAttribute('aria-expanded', 'true');
      expect(nav()).toHaveClass('eao-header__nav--open');

      await user.click(toggler());
      expect(toggler()).toHaveAttribute('aria-expanded', 'false');
      expect(nav()).not.toHaveClass('eao-header__nav--open');
    });

    it('closes on Escape and hands focus back to the toggler', async () => {
      const user = userEvent.setup();
      renderHeader();

      await user.click(toggler());
      screen.getByRole('link', { name: 'Map Explorer' }).focus();

      await user.keyboard('{Escape}');
      expect(toggler()).toHaveAttribute('aria-expanded', 'false');
      expect(toggler()).toHaveFocus();
    });

    it('closes when a link in it is used, even on the page it points at', async () => {
      const user = userEvent.setup();
      renderHeader('/search');

      await user.click(toggler());
      await user.click(screen.getByRole('link', { name: 'Search' }));

      expect(toggler()).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes when something else navigates', async () => {
      const user = userEvent.setup();
      const router = renderHeader();

      await user.click(toggler());
      expect(toggler()).toHaveAttribute('aria-expanded', 'true');

      await router.navigate('/about');

      await waitFor(() => expect(toggler()).toHaveAttribute('aria-expanded', 'false'));
    });

    it('closes when the window widens past the desktop breakpoint, and only then', async () => {
      const user = userEvent.setup();
      const desktop = stubDesktopQuery();
      try {
        renderHeader();
        await user.click(toggler());

        // Narrowing leaves the panel alone: it is the only way to reach the links down there.
        desktop.cross(false);
        expect(toggler()).toHaveAttribute('aria-expanded', 'true');

        // Above the breakpoint the links are on the bar, so the panel state has to be dropped or
        // it comes back open the next time the window narrows.
        desktop.cross(true);
        expect(toggler()).toHaveAttribute('aria-expanded', 'false');
      } finally {
        desktop.restore();
      }
    });

    it('closes on a pointer down outside the masthead', async () => {
      const user = userEvent.setup();
      renderHeader();

      await user.click(toggler());
      await user.click(document.body);

      expect(toggler()).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
