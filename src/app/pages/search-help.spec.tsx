import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../test-utils';
import { SearchHelp } from './search-help';

function renderPage(element: React.ReactElement) {
  return renderAt('/', [{ path: '/', element }]);
}

/** The band the page opens with: the shared masthead around its h1. */
function bandOf(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 1, name: title });
  const band = heading.closest('.page-masthead');
  expect(band, `${title} is not in the shared masthead`).not.toBeNull();
  return band as HTMLElement;
}

describe('search help', () => {
  it('opens with the masthead and no actions', () => {
    renderPage(<SearchHelp />);

    const band = bandOf('Advanced Search Help');
    expect(within(band).getByText(/^Learn some tips/)).toBeInTheDocument();
    expect(within(band).queryByRole('link')).not.toBeInTheDocument();
  });

  it('leaves the main landmark to the app shell', () => {
    renderPage(<SearchHelp />);

    expect(screen.getByRole('heading', { name: 'Quotes' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
