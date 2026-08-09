import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Utils } from 'app/shared/utils/utils';
import { ContentResultComponent } from './content-result.component';

function card(data: any) {
  // Reset first: TestBed refuses to be reconfigured once instantiated, and each case builds its own.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [Utils] });
  const fixture = TestBed.createComponent(ContentResultComponent);
  fixture.componentRef.setInput('result', data);
  fixture.detectChanges();
  return fixture;
}

describe('content result card', () => {
  it('links to the document, opening at its first matching page', () => {
    const c = card({ _id: 'doc1', documentName: 'Fish and Fish Habitat.pdf', pages: [8, 33] }).componentInstance;
    expect(c.pageUrl(8)).toContain('/api/public/document/doc1/download/');
    // eagle-api serves PDFs inline, so the fragment opens the viewer on that page.
    expect(c.pageUrl(8).endsWith('#page=8')).toBe(true);
    // No page means the plain document URL, with no dangling fragment.
    expect(c.pageUrl().includes('#')).toBe(false);
  });

  it('summarises matches and pages', () => {
    // The overflow count is part of the page total, or a long document under-reports itself.
    expect(card({ matchCount: 29, pages: [1, 2, 3], morePages: 9 }).componentInstance.matchSummary())
      .toBe('29 matches on 12 pages');
    // Singular, and no page clause when there is one — "1 matches on 1 pages" reads as a bug.
    expect(card({ matchCount: 1, pages: [4] }).componentInstance.matchSummary()).toBe('1 match');
  });

  it('renders the highlighted snippet as markup, not as text', () => {
    const el: HTMLElement = card({
      _id: 'd', documentName: 'x', pages: [1],
      snippets: ['the <mark>fish</mark> habitat']
    }).nativeElement;
    expect(el.querySelectorAll('.result-snippet mark').length).toBe(1);
  });

  it('says so when a fuzzy match returns no highlight', () => {
    // Azure returns no highlights for fuzzy/wildcard matches; an empty card reads as a bug.
    const el: HTMLElement = card({ _id: 'd', documentName: 'x', pages: [1], snippets: [] }).nativeElement;
    expect(el.querySelector('.no-snippet')?.textContent).toContain('Match found');
  });
});
