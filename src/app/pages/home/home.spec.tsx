import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../../test-utils';
import { stubFetch } from './home-fetch.spec-helper';
import { Home } from './home';

function renderHome() {
  stubFetch(() => undefined);
  return renderAt('/', [{ path: '/', Component: Home }]);
}

const follows = (first: Element, second: Element) =>
  !!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('home page shell', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens on one h1, inside the shared band with the search row', () => {
    renderHome();

    const title = screen.getByRole('heading', { level: 1, name: 'Environmental Assessments' });
    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([title]);
    const band = title.closest('section') as HTMLElement;
    expect(within(band).getByRole('search')).toBeInTheDocument();
  });

  it('carries no breadcrumb: the home page is the root of the trail', () => {
    renderHome();

    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('reads feed, then the rail (comment periods, uploads)', () => {
    renderHome();

    const feed = screen.getByRole('heading', { level: 2, name: 'Updates' });
    const periods = screen.getByRole('heading', { level: 2, name: 'Open for comment' });
    const uploads = screen.getByRole('heading', { level: 2, name: 'Recent Uploads' });
    expect(follows(feed, periods)).toBe(true);
    expect(follows(periods, uploads)).toBe(true);
  });

  it('reads h1, then Map Explorer, the feed, the rail and About, in that order', () => {
    renderHome();

    const title = screen.getByRole('heading', { level: 1 });
    const sections = screen.getAllByRole('heading', { level: 2 });
    expect(sections.map((h) => h.textContent)).toEqual([
      'Map Explorer',
      'Updates',
      'Open for comment',
      'Recent Uploads',
      'About',
    ]);
    expect(follows(title, sections[0])).toBe(true);
  });

  it('points the Map Explorer band at the projects map', () => {
    renderHome();

    const band = screen.getByRole('region', { name: 'Map Explorer' });
    expect(within(band).getByRole('link', { name: 'Open Map Explorer' })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('links the About band to the About page', () => {
    renderHome();

    const band = screen.getByRole('region', { name: 'About' });
    expect(
      within(band).getByRole('link', { name: 'About environmental assessment' }),
    ).toHaveAttribute('href', '/about');
  });

  it('lists three About rows, each opening its own section of the About page', () => {
    renderHome();

    const list = within(screen.getByRole('region', { name: 'About' })).getByRole('list');
    const rows = within(list).getAllByRole('link');
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/about#process',
      '/about#legislation',
      '/about#compliance',
    ]);
    expect(rows[0]).toHaveAccessibleName(/^Which Act applies /);
    expect(rows[1]).toHaveAccessibleName(/^Legislation /);
    expect(rows[2]).toHaveAccessibleName(/^Compliance oversight /);
  });

  it('opens no reader on the bare home page', () => {
    renderHome();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('drops the intro paragraph: the band opens on the title and the search row', () => {
    renderHome();

    const title = screen.getByRole('heading', { level: 1, name: 'Environmental Assessments' });
    const band = title.closest('section') as HTMLElement;
    expect(within(band).queryByText(/provides opportunities for Indigenous Nations/)).toBeNull();
    // The search row is what follows the title, with nothing of the page's own prose in between.
    expect(follows(title, within(band).getByRole('search'))).toBe(true);
  });

  it('no longer carries the hero actions, the About cards or the old activity table', () => {
    renderHome();

    expect(
      screen.queryByRole('link', { name: 'Find Environmental Assessment Projects' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'About the B.C. Environmental Assessment Process' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
