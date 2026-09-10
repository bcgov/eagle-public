import { describe, it, expect, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SiteHeader } from './site-header';
import { adminUrl, loadConfig, type EnvConfig } from 'app/config/config';

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

function staffLogin() {
  return screen.getByRole('link', { name: /^Log in/ });
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
  it('sends mark and site name home through one link named for the site', () => {
    renderHeader('/search');

    const header = screen.getByRole('banner');
    const home = within(header)
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/');
    expect(home).toHaveLength(1);
    // Loose on the join: whether the two text nodes are separated by a space is up to the
    // accessible-name implementation, and jsdom's does not add one.
    expect(home[0]).toHaveAccessibleName(
      /^EPIC\s*Environmental Assessment Office Project Information Centre$/,
    );

    // The mark is decorative inside a link that already says where it goes.
    const mark = home[0].querySelector('img');
    expect(mark).toHaveAttribute('src', '/assets/images/BCID_H_rgb_rev.svg');
    expect(mark).toHaveAttribute('alt', '');
  });

  it('lists the four masthead destinations in order', () => {
    renderHeader();

    const links = within(nav()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/projects',
      '/projects-list',
      '/contact',
      adminUrl(),
    ]);
    expect(links.slice(0, 3).map((link) => link.textContent)).toEqual([
      'Map Explorer',
      'Search',
      'Contact Us',
    ]);
    expect(links[3].textContent).toBe('Log in (opens in new tab)');
    expect(links[3]).toHaveAccessibleName(/^Log in\s*\(opens in new tab\)$/);
  });

  it('sends staff login to the configured admin app in a new tab, and says so', () => {
    renderHeader();

    const staff = staffLogin();
    expect(staff).toHaveAttribute('href', adminUrl());
    expect(staff).toHaveAttribute('target', '_blank');
    expect(staff).toHaveAttribute('rel', 'noopener');
    expect(staff).toHaveAccessibleName(/^Log in\s*\(opens in new tab\)$/);
  });

  it('marks the link for the page being viewed', () => {
    renderHeader('/contact');

    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute(
      'aria-current',
      'page',
    );
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

  // jsdom has no layout, so the height is always 0; what a spec can hold is that the map page's
  // variable (pages/projects/projlist-filters.css) is still written on mount.
  it('publishes its height for the map page', () => {
    renderHeader();

    expect(document.documentElement.style.getPropertyValue('--header-total-height')).toMatch(
      /^\d+px$/,
    );
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

    it('hands focus back to the toggler when staff login opens its new tab', async () => {
      const user = userEvent.setup();
      renderHeader();

      await user.click(toggler());
      await user.click(staffLogin());

      // The new tab takes over elsewhere; this tab's focus must not be left on a hidden panel.
      expect(toggler()).toHaveAttribute('aria-expanded', 'false');
      expect(nav()).not.toHaveClass('eao-header__nav--open');
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

      await router.navigate('/contact');

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
