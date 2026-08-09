import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfigService } from 'app/services/config.service';
import { Utils } from 'app/shared/utils/utils';
import { createContentSearchConfig } from './content-search.config';
import { ContentSearchTableRowsComponent } from './search-content-table-rows/search-content-table-rows.component';

const LISTS = [
  { _id: 'm1', name: 'Application Review', type: 'label' },
  { _id: 't1', name: 'Letter', type: 'doctype' },
  { _id: 'a1', name: 'Proponent', type: 'author' },
  { _id: 'p1', name: 'Pre-Application', type: 'projectPhase' },
];

function config() {
  TestBed.configureTestingModule({
    providers: [{ provide: ConfigService, useValue: { lists: of(LISTS) } }],
  });
  return TestBed.runInInjectionContext(() => createContentSearchConfig());
}

describe('content search config', () => {
  it('searches the DocumentChunk dataset', () => {
    expect(config().datasetType).toBe('DocumentChunk');
  });

  // -score means "issue no $orderby", which is what leaves BM25's ranking in place. Any real sort
  // field here would replace relevance with an alphabetical or chronological order.
  it('defaults to relevance, not a field sort', () => {
    expect(config().defaultSort).toBe('-score');
  });

  // Document Author and Project Phase are not fields on a chunk. Offering them would render
  // controls whose selections eagle-search drops, which looks like a broken filter, not a missing one.
  it('offers only the filters the chunk index carries', () => {
    const ids = config().filterBuilder(LISTS).map((f: any) => f.id).sort();
    expect(ids).toEqual(['issuedDate', 'milestone', 'type']);
  });

  it('shows both search tabs', () => {
    expect(config().tabs?.map(t => t.link)).toEqual(['/search', '/search/content']);
  });
});

describe('content search row', () => {
  function row(data: any) {
    // Reset first: TestBed refuses to be reconfigured once instantiated, and each case builds its
    // own component.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Utils] });
    const c = TestBed.runInInjectionContext(() => new ContentSearchTableRowsComponent());
    c.rowData = data;
    return c;
  }

  // Results are DOCUMENTS now, not chunks — the service groups them — so the download and the link
  // both resolve against the document id directly.
  it('links to the document, opening at its first matching page', () => {
    const c = row({ _id: 'doc1', documentName: 'Fish and Fish Habitat.pdf', pages: [8, 33] });
    expect(c.pageUrl(8)).toContain('/api/public/document/doc1/download/');
    // eagle-api serves PDFs inline, so the fragment opens the viewer on that page.
    expect(c.pageUrl(8).endsWith('#page=8')).toBe(true);
    // No page means the plain document URL, with no dangling fragment.
    expect(c.pageUrl().includes('#')).toBe(false);
  });

  it('summarises matches and pages', () => {
    expect(row({ matchCount: 29, pages: [1, 2, 3], morePages: 9 }).matchSummary).toBe('29 matches on 12 pages');
    // Singular, and no page clause when there is only one — "1 matches on 1 pages" reads as a bug.
    expect(row({ matchCount: 1, pages: [4] }).matchSummary).toBe('1 match');
  });
});
