import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectNotificationDocumentsTableRowsComponent } from './project-notification-documents-table-rows.component';

describe('project notification document row', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the document in the browser when the name is clicked', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(ProjectNotificationDocumentsTableRowsComponent);
    fixture.componentInstance.rowData = { _id: 'doc1', displayName: 'Notice.pdf' };
    fixture.componentInstance.tableData = { data: {} } as any;
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('td[data-label="Document Name"]') as HTMLElement).click();

    expect(open).toHaveBeenCalledWith('/demi-search/documents/doc1/download?redirect=1&inline=1', '_blank');
  });
});
