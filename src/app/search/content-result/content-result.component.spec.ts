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
  it('links to the document with NO page fragment', () => {
    // pageNumber is a passage sequence number, not a PDF page, so a #page=N fragment built from it
    // points somewhere arbitrary. Measured: a 63-chunk document carries 51 distinct values.
    const c = card({ _id: 'doc1', documentName: 'Fish and Fish Habitat.pdf' }).componentInstance;
    expect(c.documentUrl()).toContain('/api/public/document/doc1/download/');
    expect(c.documentUrl().includes('#')).toBe(false);
  });

  it('summarises matches only', () => {
    expect(card({ matchCount: 29 }).componentInstance.matchSummary()).toBe('29 matches');
    expect(card({ matchCount: 1 }).componentInstance.matchSummary()).toBe('1 match');
  });

  it('renders the highlighted snippet as markup, not as text', () => {
    const el: HTMLElement = card({
      _id: 'd', documentName: 'x',
      snippets: ['the <mark>fish</mark> habitat']
    }).nativeElement;
    expect(el.querySelectorAll('.result-snippet mark').length).toBe(1);
  });

  it('says so when a fuzzy match returns no highlight', () => {
    // Azure returns no highlights for fuzzy/wildcard matches; an empty card reads as a bug.
    const el: HTMLElement = card({ _id: 'd', documentName: 'x', snippets: [] }).nativeElement;
    expect(el.querySelector('.no-snippet')?.textContent).toContain('Match found');
  });
});
