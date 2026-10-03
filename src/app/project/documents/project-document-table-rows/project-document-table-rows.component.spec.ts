import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DocumentTableRowsComponent } from './project-document-table-rows.component';

describe('project document table row', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the document in the browser when the name is clicked', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(DocumentTableRowsComponent);
    fixture.componentInstance.rowData = { _id: 'doc1', displayName: 'Report.pdf' };
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('td[data-label="Name"]') as HTMLElement).click();

    expect(open).toHaveBeenCalledWith('/demi-search/documents/doc1/download?redirect=1&inline=1', '_blank');
  });
});
