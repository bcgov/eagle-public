import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../test-utils';
import { MastheadLink, PageMasthead } from './page-masthead';

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

  it('puts the lede under the title, before the actions', () => {
    renderMasthead(
      <PageMasthead
        title="Legislation"
        lede="Learn about the legislation."
        actions={<MastheadLink label="Act" href="https://example.gov.bc.ca/act" />}
      />,
    );

    const lede = screen.getByText('Learn about the legislation.');
    const heading = screen.getByRole('heading', { level: 1, name: 'Legislation' });
    const action = screen.getByRole('link', { name: 'Act' });
    expect(heading.compareDocumentPosition(lede) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lede.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('masthead link', () => {
  it('says a new-tab link opens a new tab, and cuts the opener', () => {
    renderMasthead(<MastheadLink label="2018 Act" href="https://example.gov.bc.ca/act" newTab />);

    const link = screen.getByRole('link', { name: /^2018 Act\s*\(opens in new tab\)$/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('btn-on-dark');
  });

  it('keeps a same-tab link in the tab, its icon hidden from the name', () => {
    renderMasthead(
      <MastheadLink label="Submit your Feedback" href="mailto:someone@gov.bc.ca" icon="email" />,
    );

    const link = screen.getByRole('link', { name: 'Submit your Feedback' });
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('rel');
    expect(link).toHaveAttribute('href', 'mailto:someone@gov.bc.ca');
  });
});
