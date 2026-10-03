import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { DocSearchTableRowsComponent } from './search-document-table-rows.component';

describe('document search result row', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves the document as a file from the download icon', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    const fixture = TestBed.createComponent(DocSearchTableRowsComponent);
    fixture.componentInstance.rowData = { _id: 'doc1', displayName: 'Report.pdf', project: { _id: 'p1', name: 'Mine' } };
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Download document button"]') as HTMLElement).click();

    expect(open).toHaveBeenCalledWith('/demi-search/documents/doc1/download?redirect=1', '_blank');
  });
});
