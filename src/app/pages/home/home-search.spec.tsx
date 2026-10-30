import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { TYPEAHEAD_DEBOUNCE_MS } from 'app/components/filters/typeahead';
import { renderAt } from '../../../test-utils';
import { json, stubFetch } from './home-fetch.spec-helper';
import { HomeSearch } from './home-search';

function SearchPage() {
  return <p>search page {useLocation().search}</p>;
}

/**
 * Renders the search row with a stand-in /search route. Its loader waits until `release` is
 * called, the way the real /search loader holds the router in its loading state.
 */
function renderSearch() {
  let release!: () => void;
  const loaderDone = new Promise<null>((resolve) => {
    release = () => resolve(null);
  });
  const view = renderAt('/', [
    { path: '/', Component: HomeSearch },
    { path: '/search', loader: () => loaderDone, Component: SearchPage },
  ]);
  return { ...view, release };
}

const keywordBox = () => screen.getByRole('combobox', { name: 'Search by keyword' });
const picker = () => screen.getByRole('combobox', { name: 'What to search' });

/** The query string the router landed on, as a plain object. */
function landedOn(router: ReturnType<typeof renderSearch>['router']): Record<string, string> {
  expect(router.state.location.pathname).toBe('/search');
  return Object.fromEntries(new URLSearchParams(router.state.location.search));
}

beforeEach(() => {
  stubFetch(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('home search row', () => {
  it('labels the field and the record-type picker, which offers the /search types', () => {
    renderSearch();

    expect(keywordBox()).toBeInTheDocument();
    expect(picker()).toHaveValue('projects');
    expect(
      within(picker())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Projects',
      'Documents',
      'Activities & updates',
      'Project notifications',
      'Comment periods',
    ]);
  });

  it('hands the keyword and the record type to /search', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    await user.type(keywordBox(), '  Site C  ');
    await user.selectOptions(picker(), 'Documents');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'documents', keywords: 'Site C' });
  });

  it('sends Activities & updates to the activities record type, submitted with Enter', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    // By the option node: user-event matches text through innerHTML, where `&` reads `&amp;`.
    await user.selectOptions(
      picker(),
      within(picker()).getByRole('option', { name: 'Activities & updates' }),
    );
    await user.type(keywordBox(), 'decision{Enter}');
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'activities', keywords: 'decision' });
  });

  it('sends Project notifications to the notifications record type', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    await user.type(keywordBox(), 'mine');
    await user.selectOptions(picker(), 'Project notifications');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'notifications', keywords: 'mine' });
  });

  it('sends Comment periods to the commentPeriods record type', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    await user.selectOptions(picker(), 'Comment periods');
    await user.type(keywordBox(), 'pipeline');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'commentPeriods', keywords: 'pipeline' });
  });

  it('opens /search with no keyword when the field is empty', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    await user.click(screen.getByRole('button', { name: 'Search' }));
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'projects' });
  });

  describe('suggestions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Testing Library drains its event wrapper on a setTimeout it only advances when `jest` exists.
      vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Lets the typing pause run out and the answer land. */
    async function pause(): Promise<void> {
      await act(() => vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_MS));
      await act(() => vi.advanceTimersByTimeAsync(0));
    }

    const typist = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    it("typing 'ce' lists suggestions under the field", async () => {
      stubFetch((url) =>
        url.includes('/suggest?')
          ? json({
              items: [
                { id: 'p1', eagleId: 'cedar-lng', name: 'Cedar LNG' },
                { id: 'p2', eagleId: 'centerm', name: 'Centerm Expansion' },
              ],
            })
          : undefined,
      );
      const user = typist();
      renderSearch();

      await user.type(keywordBox(), 'ce');
      await pause();
      const list = screen.getByRole('listbox', { name: 'Projects suggestions' });

      expect(within(list).getByRole('option', { name: 'Cedar LNG' })).toBeInTheDocument();
      expect(within(list).getByRole('option', { name: 'Centerm Expansion' })).toBeInTheDocument();
    });

    it('suggests from the record type picked', async () => {
      const requests = stubFetch(() => undefined);
      const user = typist();
      renderSearch();

      await user.selectOptions(picker(), 'Documents');
      await user.type(keywordBox(), 'ce');
      await pause();

      expect(requests.filter((url) => url.includes('/suggest?'))).toEqual([
        expect.stringContaining('/suggest?kind=documents'),
      ]);
    });

    it('runs the same search, status line included, from the footer row', async () => {
      const user = typist();
      const { router, release } = renderSearch();

      await user.type(keywordBox(), 'coal');
      await pause();
      await user.click(screen.getByRole('option', { name: 'Search all projects for “coal”' }));

      expect(screen.getByRole('status')).toHaveTextContent('Opening search for “coal” …');
      release();
      await screen.findByText(/search page/);
      expect(landedOn(router)).toEqual({ record: 'projects', keywords: 'coal' });
    });
  });

  it('announces the handoff in a status line that was there before the submit', async () => {
    const user = userEvent.setup();
    const { container, release } = renderSearch();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');
    expect(container.querySelector('.spinner-border')).toBeNull();

    await user.type(keywordBox(), 'coal');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    // Same node: a live region only speaks for text that changes inside it.
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Opening search for “coal” …');
    // The spinner lasts as long as the /search loader does.
    expect(container.querySelector('.spinner-border')).not.toBeNull();

    release();
    await screen.findByText(/search page/);
  });
});
