import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { itOpensDocumentInNewTab } from 'app/shared/utils/document-link.spec-helper';
import { CommentsTableRowsComponent } from './comments-table-rows.component';

const FILE = { _id: 'doc1', displayName: 'Letter', documentFileName: 'letter-1.pdf', internalOriginalName: 'letter.pdf', documentSource: 'COMMENT' };

function attachmentLink(): HTMLAnchorElement {
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  const fixture = TestBed.createComponent(CommentsTableRowsComponent);
  fixture.componentInstance.rowData = { comment: 'Hi', documents: [FILE] };
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('a.attachment');
}

describe('comment attachment', () => {
  afterEach(() => vi.restoreAllMocks());

  itOpensDocumentInNewTab(attachmentLink);

  it('records the open with the document source', () => {
    const link = attachmentLink();
    const track = vi.spyOn(TestBed.inject(AnalyticsService), 'track');

    link.click();

    expect(track).toHaveBeenCalledWith('Document Opened', { document_id: 'doc1', document_name: 'Letter', document_source: 'COMMENT' });
  });
});
