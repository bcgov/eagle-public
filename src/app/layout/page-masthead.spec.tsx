import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../test-utils';
import { PageMasthead } from './page-masthead';

function renderMasthead(element: React.ReactElement) {
  return renderAt('/', [{ path: '/', element }]);
}

describe('page masthead', () => {
  it('makes the title the page h1 and lays the trail above it', () => {
    renderMasthead(
      <PageMasthead
        title="Search"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Search' }]}
      />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Search' });
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([heading]);
    expect(within(trail).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(trail.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('carries no trail on a page that has none, but holds the row its height', () => {
    const { container } = renderMasthead(<PageMasthead title="Environmental Assessments" />);

    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(container.querySelector('.page-masthead__trail')).toBeEmptyDOMElement();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Environmental Assessments' }),
    ).toBeInTheDocument();
  });

  it('draws the band on the shared content width', () => {
    const { container } = renderMasthead(<PageMasthead title="Search" />);

    expect(container.querySelector('.page-masthead__inner')).toHaveClass('page-container');
  });

  it('shows the meta line, the actions and the page content it is given', () => {
    renderMasthead(
      <PageMasthead
        title="Cedar Quarry"
        meta="Cedar Quarry Partners LP"
        actions={<button type="button">Subscribe</button>}
      >
        <p>Open for comment</p>
      </PageMasthead>,
    );

    expect(screen.getByText('Cedar Quarry Partners LP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    expect(screen.getByText('Open for comment')).toBeInTheDocument();
  });

  it('leaves the meta line and the action row out when a page gives neither', () => {
    const { container } = renderMasthead(<PageMasthead title="Search" />);

    expect(container.querySelector('.page-masthead__meta')).toBeNull();
    expect(container.querySelector('.page-masthead__actions')).toBeNull();
  });

  it('says the band is busy only while the page is still fetching what it names', () => {
    const { container, rerender } = renderMasthead(<PageMasthead title="Cedar Quarry" busy />);
    expect(container.querySelector('.page-masthead')).toHaveAttribute('aria-busy', 'true');

    rerender(<PageMasthead title="Cedar Quarry" />);
    expect(container.querySelector('.page-masthead')).not.toHaveAttribute('aria-busy');
  });
});
