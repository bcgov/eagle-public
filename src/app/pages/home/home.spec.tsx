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

  it('opens on one h1, inside the labelled statement band with the search row', () => {
    renderHome();

    const band = screen.getByRole('region', { name: 'Environmental Assessments' });
    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([
      within(band).getByRole('heading', { level: 1, name: 'Environmental Assessments' }),
    ]);
    expect(within(band).getByRole('search')).toBeInTheDocument();
  });

  it('reads feed, then the rail (comment periods, uploads), then the Browse strip', () => {
    renderHome();

    const feed = screen.getByRole('heading', { level: 2, name: 'Updates' });
    const periods = screen.getByRole('heading', { level: 2, name: 'Open for comment' });
    const uploads = screen.getByRole('heading', { level: 2, name: 'Recent Uploads' });
    const browse = screen.getByRole('navigation', { name: 'Browse' });
    expect(follows(feed, periods)).toBe(true);
    expect(follows(periods, uploads)).toBe(true);
    expect(follows(uploads, browse)).toBe(true);
  });

  it('opens no reader on the bare home page', () => {
    renderHome();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
