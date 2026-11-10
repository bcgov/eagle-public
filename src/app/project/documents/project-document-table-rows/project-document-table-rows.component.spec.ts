import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { itOpensDocumentInNewTab } from 'app/shared/utils/document-link.spec-helper';
import { DocumentTableRowsComponent } from './project-document-table-rows.component';

describe('project document table row', () => {
  afterEach(() => vi.restoreAllMocks());

  function row(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(DocumentTableRowsComponent);
    fixture.componentInstance.rowData = { _id: 'doc1', displayName: 'Report.pdf' };
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  itOpensDocumentInNewTab(() => row().querySelector('td[data-label="Name"] a') as HTMLAnchorElement);

  it('opens the document in the browser when another cell is clicked', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    (row().querySelector('td[data-label="Date"]') as HTMLElement).click();
    expect(open).toHaveBeenCalledWith('/demi-search/documents/doc1/download?inline=1', '_blank');
  });
});
