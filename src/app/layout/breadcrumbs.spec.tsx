import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../test-utils';
import { Breadcrumbs, type Crumb } from './breadcrumbs';

function renderTrail(items: Crumb[]) {
  return renderAt('/p/proj-1', [{ path: '/p/:projId', element: <Breadcrumbs items={items} /> }]);
}

function trail() {
  return screen.getByRole('navigation', { name: 'Breadcrumb' });
}

describe('breadcrumbs', () => {
  it('links every crumb but the last, which names the page you are on', () => {
    renderTrail([
      { label: 'Home', to: '/' },
      { label: 'Projects', to: '/projects' },
      { label: 'Cedar Quarry', to: '/p/proj-1' },
    ]);

    const links = within(trail()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/projects']);
    expect(links.map((link) => link.textContent)).toEqual(['Home', 'Projects']);

    const current = within(trail()).getByText('Cedar Quarry');
    expect(current.tagName).toBe('SPAN');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('marks one crumb only, and puts them in an ordered list', () => {
    const { container } = renderTrail([{ label: 'Home', to: '/' }, { label: 'Search' }]);

    expect(container.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(within(trail()).getAllByRole('listitem')).toHaveLength(2);
    expect(trail().querySelector('ol')).toBeInTheDocument();
  });

  it('separates the crumbs without writing a character a screen reader would read', () => {
    renderTrail([{ label: 'Home', to: '/' }, { label: 'Search' }]);

    expect(trail()).toHaveTextContent(/^HomeSearch$/);
  });

  it('renders nothing when there is no trail', () => {
    const { container } = renderTrail([]);

    expect(container.querySelector('nav')).toBeNull();
  });
});
