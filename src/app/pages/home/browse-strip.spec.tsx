import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../../test-utils';
import { BrowseStrip } from './browse-strip';

const ENTRIES = [
  ['Map Explorer', '/projects'],
  ['All projects', '/search?record=projects'],
  ['Project notifications', '/search?record=notifications'],
  // Nothing else on the site links these three pages, which the old header and e2e still expect.
  ['The assessment process', '/process'],
  ['Legislation', '/legislation'],
  ['Compliance oversight', '/compliance-oversight'],
];

function renderStrip() {
  renderAt('/', [{ path: '/', Component: BrowseStrip }]);
  return screen.getByRole('navigation', { name: 'Browse' });
}

describe('home browse strip', () => {
  it('lists six links, in the designed order', () => {
    const strip = renderStrip();

    expect(
      within(strip)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(ENTRIES.map(([, href]) => href));
  });

  // An exact name match also proves the icon ligature stays out of the accessible name.
  it.each(ENTRIES)('names the %s link by its visible label and sends it to %s', (name, href) => {
    const strip = renderStrip();

    expect(within(strip).getByRole('link', { name })).toHaveAttribute('href', href);
  });
});
