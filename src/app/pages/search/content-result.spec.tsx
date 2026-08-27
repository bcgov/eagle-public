import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ContentResult } from './content-result';

function card(data: any) {
  return render(
    <MemoryRouter>
      <ContentResult result={data} />
    </MemoryRouter>
  );
}

describe('content result card', () => {
  it('links to the document with NO page fragment', () => {
    // pageNumber is a passage sequence number, not a PDF page, so a #page=N fragment built from it
    // points somewhere arbitrary. Measured: a 63-chunk document carries 51 distinct values.
    card({ _id: 'doc1', documentName: 'Fish and Fish Habitat.pdf' });

    const link = screen.getByRole('link', { name: 'Fish and Fish Habitat.pdf' });
    expect(link.getAttribute('href')).toContain('/api/public/document/doc1/download/');
    expect(link.getAttribute('href')).not.toContain('#');
  });

  it('summarises matches only', () => {
    card({ _id: 'a', documentName: 'x', matchCount: 29 });
    expect(screen.getByText('29 matches')).toBeInTheDocument();

    card({ _id: 'b', documentName: 'y', matchCount: 1 });
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('renders the highlighted snippet as markup, not as text', () => {
    const { container } = card({ _id: 'd', documentName: 'x', snippets: ['the <mark>fish</mark> habitat'] });
    expect(container.querySelectorAll('.result-snippet mark')).toHaveLength(1);
  });

  it('strips markup the search backend never emits', () => {
    const { container } = card({
      _id: 'd',
      documentName: 'x',
      snippets: ['<img src=x onerror=alert(1)> the <mark>fish</mark>']
    });
    expect(container.querySelector('.result-snippet img')).toBeNull();
    expect(container.querySelectorAll('.result-snippet mark')).toHaveLength(1);
  });

  it('says so when a fuzzy match returns no highlight', () => {
    const { container } = card({ _id: 'd', documentName: 'x', snippets: [] });
    expect(container.querySelector('.no-snippet')?.textContent).toContain('Match found');
  });
});
