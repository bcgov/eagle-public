import { describe, it, expect, vi } from 'vitest';
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
  it('downloads the parent document, not the chunk', () => {
    const openDocumentDownload = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: Utils, useValue: { openDocumentDownload } }],
    });
    const row = TestBed.runInInjectionContext(() => new ContentSearchTableRowsComponent());

    // A chunk's own key is `${documentId}_p{page}_c{index}`; requesting it as a document 404s.
    row.goToItem({
      _id: '5886aa8ae036fb0105769453_p7_c11',
      documentId: '5886aa8ae036fb0105769453',
      documentName: 'Fish and Fish Habitat Assessment',
    });

    expect(openDocumentDownload).toHaveBeenCalledWith({
      _id: '5886aa8ae036fb0105769453',
      displayName: 'Fish and Fish Habitat Assessment',
    });
  });
});
