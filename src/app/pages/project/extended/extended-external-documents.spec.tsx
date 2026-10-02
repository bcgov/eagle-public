import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { pacificLink } from './content/pacific-link';
import { ExtendedExternalDocuments } from './extended-external-documents';
import type { ExternalDocumentGroup, ExtendedPage } from './types';

const HEADING = 'Documents published by others';

function withGroups(groups: ExternalDocumentGroup[]): ExtendedPage {
  return {
    ...pacificLink,
    documents: {
      ...pacificLink.documents,
      external: { heading: HEADING, intro: 'Hosted elsewhere.', groups },
    },
  };
}

describe('ExtendedExternalDocuments', () => {
  it('renders nothing when the content has no groups', () => {
    const { container } = render(<ExtendedExternalDocuments content={withGroups([])} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('names each publisher and links each document to its file in a new tab', () => {
    render(
      <ExtendedExternalDocuments
        content={withGroups([
          {
            publisher: 'Government of Alberta',
            items: [
              {
                title: 'Pipeline submission',
                date: '2 Jul 2026',
                format: 'PDF',
                pages: 89,
                href: 'https://example.ca/submission.pdf',
              },
            ],
          },
        ])}
      />,
    );

    const section = screen.getByRole('region', { name: HEADING });
    expect(
      within(section).getByRole('heading', { level: 4, name: 'Government of Alberta' }),
    ).toBeInTheDocument();
    const link = within(section).getByRole('link', { name: /^Pipeline submission/ });
    expect(link).toHaveAttribute('href', 'https://example.ca/submission.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(section).getByText('2 Jul 2026 · PDF, 89 pages')).toBeInTheDocument();
  });

  it('leaves the date out of the details of an undated document', () => {
    render(
      <ExtendedExternalDocuments
        content={withGroups([
          {
            publisher: 'Government of Alberta',
            items: [
              {
                title: 'Fact sheet',
                format: 'PDF',
                pages: 1,
                href: 'https://example.ca/fact-sheet.pdf',
              },
            ],
          },
        ])}
      />,
    );

    expect(screen.getByText('PDF, 1 page')).toBeInTheDocument();
  });

  it('adds the language to the details and tags the title with it', () => {
    render(
      <ExtendedExternalDocuments
        content={withGroups([
          {
            publisher: 'Government of Alberta',
            items: [
              {
                title: 'Résumé',
                date: '3 Jul 2026',
                format: 'PDF',
                pages: 23,
                language: { label: 'French', code: 'fr' },
                href: 'https://example.ca/resume-fr.pdf',
              },
            ],
          },
        ])}
      />,
    );

    expect(screen.getByText('3 Jul 2026 · PDF, 23 pages, French')).toBeInTheDocument();
    expect(screen.getByText('Résumé')).toHaveAttribute('lang', 'fr');
  });
});
