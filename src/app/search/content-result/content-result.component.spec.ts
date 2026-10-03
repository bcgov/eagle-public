import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Utils } from 'app/shared/utils/utils';
import { ContentResultComponent } from './content-result.component';

function card(data: any) {
  // Reset first: TestBed refuses to be reconfigured once instantiated, and each case builds its own.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [Utils, provideHttpClient()] });
  const fixture = TestBed.createComponent(ContentResultComponent);
  fixture.componentRef.setInput('result', data);
  fixture.detectChanges();
  return fixture;
}

describe('content result card', () => {
  it('links the title to the document for viewing, with NO page fragment', () => {
    // pageNumber is a passage sequence number, not a PDF page, so a #page=N fragment built from it
    // points somewhere arbitrary. Measured: a 63-chunk document carries 51 distinct values.
    const el: HTMLElement = card({ _id: 'doc1', documentName: 'Fish and Fish Habitat.pdf' }).nativeElement;
    expect(el.querySelector('.result-title a')?.getAttribute('href')).toBe('/demi-search/documents/doc1/download?redirect=1&inline=1');
  });

  it('saves the document as a file from the Download button', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const el: HTMLElement = card({ _id: 'doc1', documentName: 'Fish.pdf' }).nativeElement;
    (el.querySelector('button.result-download') as HTMLButtonElement).click();
    expect(open).toHaveBeenCalledWith('/demi-search/documents/doc1/download?redirect=1', '_blank');
    open.mockRestore();
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
