import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { RECORD_TYPES } from 'app/components/display-grid/use-grid-url-state';
import { recordConfig } from 'app/pages/search/types';
import { renderAt } from '../../../test-utils';
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

/** The query string the router landed on, as a plain object. */
function landedOn(router: ReturnType<typeof renderSearch>['router']): Record<string, string> {
  expect(router.state.location.pathname).toBe('/search');
  return Object.fromEntries(new URLSearchParams(router.state.location.search));
}

describe('home search row', () => {
  it('labels the field and the record-type picker, which offers the /search types', () => {
    renderSearch();

    expect(
      screen.getByRole('searchbox', { name: 'Search projects and documents by keyword' }),
    ).toBeInTheDocument();
    const picker = screen.getByRole('combobox', { name: 'What to search' });
    expect(picker).toHaveValue('projects');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
      RECORD_TYPES.map((id) => recordConfig(id).label),
    );
  });

  it('hands the keyword and the record type to /search', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    await user.type(screen.getByRole('searchbox'), '  Site C  ');
    await user.selectOptions(screen.getByRole('combobox'), 'Documents');
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
      screen.getByRole('combobox'),
      screen.getByRole('option', { name: 'Activities & updates' }),
    );
    await user.type(screen.getByRole('searchbox'), 'decision{Enter}');
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'activities', keywords: 'decision' });
  });

  it('sends Project notifications to the notifications record type', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    await user.type(screen.getByRole('searchbox'), 'mine');
    await user.selectOptions(screen.getByRole('combobox'), 'Project notifications');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'notifications', keywords: 'mine' });
  });

  it('opens /search with no keyword when the field is empty', async () => {
    const user = userEvent.setup();
    const { router, release } = renderSearch();

    await user.click(screen.getByRole('button', { name: 'Search' }));
    release();

    await screen.findByText(/search page/);
    expect(landedOn(router)).toEqual({ record: 'projects' });
  });

  it('announces the handoff in a status line that was there before the submit', async () => {
    const user = userEvent.setup();
    const { container, release } = renderSearch();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');
    expect(container.querySelector('.spinner-border')).toBeNull();

    await user.type(screen.getByRole('searchbox'), 'coal');
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
