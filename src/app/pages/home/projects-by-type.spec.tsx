import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../../test-utils';
import { envelope, json, PENDING, stubFetch } from './home-fetch.spec-helper';
import { ProjectsByType } from './projects-by-type';

const project = (
  _id: string,
  name: string,
  type: string,
  sector: string,
  region = 'Skeena',
  phase = 'Early Engagement',
) => ({
  _id,
  name,
  type,
  sector,
  region,
  currentPhaseName: { _id: 'ph', name: phase },
});

const ROWS = [
  project('m1', 'Alpha Coal', 'Mines', 'Coal Mines'),
  project('m2', 'Beta Coal', 'Mines', 'Coal Mines', 'Peace', 'Post Decision - Pre-Construction'),
  project('m3', 'Gamma Copper', 'Mines', 'Mineral Mines'),
  project('m4', 'Delta Gold', 'Mines', 'Mineral Mines'),
  // Track spelling, folded into "Energy-Petroleum & Natural Gas".
  project('e1', 'Cedar Pipeline', 'Energy - Petroleum & Natural Gas', 'Transmission Pipelines'),
  project('e2', 'Kitimat Plant', 'Energy - Petroleum & Natural Gas', 'Natural Gas Processing'),
  // One sub-type only.
  project('t1', 'Highway 1 Widening', 'Transportation', 'Public Highways'),
  project('t2', 'Highway 97 Bypass', 'Transportation', 'Public Highways'),
];

const ENERGY = 'Energy-Petroleum & Natural Gas';

function renderBand(
  at = '/',
  answer: Response | typeof PENDING = envelope(ROWS),
  options: Parameters<typeof renderAt>[2] = {},
) {
  stubFetch((url) => (url.includes('dataset=Project') ? answer : undefined));
  const view = renderAt(at, [{ path: '/', Component: ProjectsByType }], options);
  const search = () => view.router.state.location.search;
  return { ...view, search };
}

const typeRow = (name: string) => screen.findByRole('link', { name: new RegExp(`^${name}, `) });
const trail = () => screen.getByRole('navigation', { name: 'Chart level' });
const currentCrumb = () =>
  within(trail()).getByText((_, el) => el?.getAttribute('aria-current') === 'location');
const COAL = '/?type=Mines&subType=Coal%20Mines';
const filterBox = () => screen.findByRole('searchbox', { name: 'Filter projects' });
const projectNames = () =>
  within(screen.getByRole('table'))
    .queryAllByRole('link')
    .map((a) => a.textContent);
const shown = () => document.querySelector('.home-types__shown');

describe('ProjectsByType', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a busy skeleton while the projects load', () => {
    const { container } = renderBand('/', PENDING);

    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(within(busy as HTMLElement).getByText('Loading')).toBeInTheDocument();
  });

  it('says the types are unavailable when the search answers no projects', async () => {
    renderBand('/', envelope([]));

    expect(await screen.findByText('Project types are unavailable right now.')).toBeInTheDocument();
    expect(screen.getByText('Try again in a moment.')).toBeInTheDocument();
  });

  it('says the types are unavailable when the search fails', async () => {
    renderBand('/', json({}, 500));

    expect(await screen.findByText('Project types are unavailable right now.')).toBeInTheDocument();
  });

  it('lists every type with its count, largest first, under the total', async () => {
    renderBand();

    await typeRow('Mines');
    const rows = screen.getAllByRole('link', { name: /, \d+ projects?\. Show/ });
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Mines, 4 projects. Show sub-types',
      `${ENERGY}, 2 projects. Show sub-types`,
      'Transportation, 2 projects. Show projects',
    ]);
    expect(rows.map((r) => r.getAttribute('href'))).toEqual([
      '/?type=Mines',
      '/?type=Energy-Petroleum+%26+Natural+Gas',
      '/?type=Transportation',
    ]);
    expect(screen.getByText('8 projects', { selector: '.home-types__count' })).toBeInTheDocument();
    expect(currentCrumb()).toHaveTextContent('All types');
  });

  it('opens a type: address, trail, sub-type rows, Search link and focus on the trail', async () => {
    const { search } = renderBand();

    await userEvent.click(await typeRow('Mines'));

    expect(search()).toBe('?type=Mines');
    expect(within(trail()).getByRole('link', { name: 'All types' })).toHaveAttribute('href', '/');
    expect(currentCrumb()).toHaveTextContent('Mines');
    expect(
      screen.getByRole('link', { name: 'Coal Mines, 2 projects. Show projects' }),
    ).toHaveAttribute('href', '/?type=Mines&subType=Coal+Mines');
    expect(screen.getByRole('status')).toHaveTextContent(/^2 sub-types, 4 projects$/);
    expect(
      screen.getByRole('link', { name: 'See all 4 Mines projects in Search' }),
    ).toHaveAttribute('href', '/search?record=projects&type=Mines');
    await waitFor(() => expect(currentCrumb()).toHaveFocus());
  });

  it('opens a sub-type: project links, hidden map and a Search link with the sector', async () => {
    const { search, container } = renderBand();

    await userEvent.click(await typeRow('Mines'));
    await userEvent.click(screen.getByRole('link', { name: /^Coal Mines, / }));

    expect(search()).toBe('?type=Mines&subType=Coal+Mines');
    const table = screen.getByRole('table', { name: 'Coal Mines projects' });
    expect(within(table).getByRole('link', { name: 'Alpha Coal' })).toHaveAttribute(
      'href',
      '/p/m1',
    );
    expect(within(table).getByRole('link', { name: 'Beta Coal' })).toHaveAttribute('href', '/p/m2');
    expect(within(table).queryByRole('link', { name: 'Gamma Copper' })).toBeNull();
    expect(container.querySelector('.home-types__map')).toHaveAttribute('aria-hidden', 'true');
    expect(currentCrumb()).toHaveTextContent('Coal Mines');
    expect(screen.getByText('2 projects', { selector: '.home-types__count' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^2 projects$/);
    expect(
      screen.getByRole('link', { name: 'See all 2 Coal Mines projects in Search' }),
    ).toHaveAttribute('href', '/search?record=projects&type=Mines&sector=Coal+Mines');
  });

  it('goes back to the top from the "All types" crumb', async () => {
    const { search } = renderBand('/?type=Mines');

    await userEvent.click(await screen.findByRole('link', { name: 'All types' }));

    expect(search()).toBe('');
    expect(await typeRow(ENERGY)).toBeInTheDocument();
    expect(currentCrumb()).toHaveTextContent('All types');
  });

  it('returns to the type level on Back', async () => {
    const { router, search } = renderBand();

    await userEvent.click(await typeRow('Mines'));
    await userEvent.click(screen.getByRole('link', { name: /^Coal Mines, / }));
    await act(() => router.navigate(-1));

    expect(search()).toBe('?type=Mines');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('link', { name: /^Mineral Mines, / })).toBeInTheDocument();
  });

  it('opens a deep link on its projects', async () => {
    renderBand('/?type=Mines&subType=Coal%20Mines');

    const table = await screen.findByRole('table', { name: 'Coal Mines projects' });
    expect(
      within(table)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Alpha Coal', 'Beta Coal']);
  });

  it('leaves focus alone when the page opens on a level', async () => {
    // StrictMode re-runs mount effects, which is how a first-render guard used to slip.
    renderBand('/?type=Mines', envelope(ROWS), { reactStrictMode: true });

    await typeRow('Mineral Mines');
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    expect(document.body).toHaveFocus();
  });

  it('opens an unknown type at the top level', async () => {
    renderBand('/?type=Bogus');

    expect(await typeRow('Mines')).toBeInTheDocument();
    expect(currentCrumb()).toHaveTextContent('All types');
  });

  it('rings the tile a hovered row stands for', async () => {
    renderBand();

    await userEvent.hover(await typeRow('Mines'));

    expect(document.querySelector<HTMLElement>('[data-fit="f:Mines"]')!).toHaveClass(
      'home-types__tile--hover',
    );
    expect(document.querySelector<HTMLElement>('[data-fit="f:Transportation"]')!).not.toHaveClass(
      'home-types__tile--hover',
    );
  });

  it('highlights the row a hovered tile stands for', async () => {
    renderBand();

    await typeRow('Mines');
    await userEvent.hover(document.querySelector<HTMLElement>('[data-fit="f:Mines"]')!);

    expect((await typeRow('Mines')).closest('li')).toHaveClass('home-types__bar-row--hover');
    expect((await typeRow('Transportation')).closest('li')).not.toHaveClass(
      'home-types__bar-row--hover',
    );
  });

  it('opens a type with one sub-type straight on its projects', async () => {
    const { search } = renderBand();

    await userEvent.click(await typeRow('Transportation'));

    expect(search()).toBe('?type=Transportation');
    const table = screen.getByRole('table', { name: 'Public Highways projects' });
    expect(within(table).getAllByRole('link')).toHaveLength(2);
    expect(currentCrumb()).toHaveTextContent('Transportation');
    expect(within(trail()).queryByText('Public Highways')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'See all 2 Transportation projects in Search' }),
    ).toHaveAttribute('href', '/search?record=projects&type=Transportation');
  });

  it('carries a type with "&" and spaces through the address and back', async () => {
    const first = renderBand();
    await userEvent.click(await typeRow(ENERGY));
    const address = first.search();
    first.unmount();

    renderBand(`/${address}`);

    expect(
      await screen.findByRole('link', { name: /^Transmission Pipelines, / }),
    ).toBeInTheDocument();
    expect(currentCrumb()).toHaveTextContent(ENERGY);
  });

  describe('project filter', () => {
    it('labels the filter and hints at what it matches', async () => {
      renderBand(COAL);

      expect(await filterBox()).toHaveAttribute('placeholder', 'Filter by name, region or phase');
      expect(shown()).toBeEmptyDOMElement();
    });

    it('keeps the rows whose name holds the text, ignoring case', async () => {
      renderBand(COAL);

      await userEvent.type(await filterBox(), 'ALPHA');

      expect(projectNames()).toEqual(['Alpha Coal']);
      expect(shown()).toHaveTextContent('1 of 2 projects shown');
      expect(
        screen.getByText('2 projects', { selector: '.home-types__count' }),
      ).toBeInTheDocument();
    });

    it('keeps the rows whose region holds the text', async () => {
      renderBand(COAL);

      await userEvent.type(await filterBox(), 'peace');

      expect(projectNames()).toEqual(['Beta Coal']);
    });

    it('keeps the rows whose phase holds the text', async () => {
      renderBand(COAL);

      await userEvent.type(await filterBox(), 'early eng');

      expect(projectNames()).toEqual(['Alpha Coal']);
    });

    it('says so when nothing matches', async () => {
      renderBand(COAL);

      await userEvent.type(await filterBox(), 'zinc');

      expect(projectNames()).toEqual([]);
      expect(screen.getByRole('cell', { name: 'No projects match.' })).toBeInTheDocument();
      expect(shown()).toHaveTextContent('0 of 2 projects shown');
    });

    it('shows every row again once the text is cleared', async () => {
      renderBand(COAL);
      const box = await filterBox();

      await userEvent.type(box, 'alpha');
      await userEvent.clear(box);

      expect(projectNames()).toEqual(['Alpha Coal', 'Beta Coal']);
      expect(shown()).toBeEmptyDOMElement();
    });

    it('starts empty on another sub-type', async () => {
      const { router } = renderBand(COAL);
      await userEvent.type(await filterBox(), 'alpha');

      await act(() => router.navigate('/?type=Mines&subType=Mineral%20Mines'));

      expect(await filterBox()).toHaveValue('');
      expect(projectNames()).toEqual(['Delta Gold', 'Gamma Copper']);
    });

    it('sits in the tab order between the trail and the project links', async () => {
      renderBand(COAL);
      const box = await filterBox();

      within(trail()).getByRole('link', { name: 'Mines' }).focus();
      await userEvent.tab();
      expect(box).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('link', { name: 'Alpha Coal' })).toHaveFocus();
    });
  });
});
