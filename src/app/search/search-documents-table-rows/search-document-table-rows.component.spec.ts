import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { pressEnter } from 'app/shared/utils/document-link.spec-helper';
import { DocSearchTableRowsComponent } from './search-document-table-rows.component';

const DOWNLOAD = '/demi-search/documents/doc1/download?redirect=1';

describe('document search result row', () => {
  afterEach(() => vi.restoreAllMocks());

  function row(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    const fixture = TestBed.createComponent(DocSearchTableRowsComponent);
    fixture.componentInstance.rowData = { _id: 'doc1', displayName: 'Report.pdf', project: { _id: 'p1', name: 'Mine' } };
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('links the name to the document download', () => {
    expect(row().querySelector('td[data-label="Name"] a')?.getAttribute('href')).toBe(DOWNLOAD);
  });

  it('links the download icon to the same address, out of the tab order', () => {
    const icon = row().querySelector('td[data-label="Download"] a');
    expect(icon?.getAttribute('href')).toBe(DOWNLOAD);
    expect(icon?.getAttribute('tabindex')).toBe('-1');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('records the download on click and leaves the download itself to the link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const link = row().querySelector('td[data-label="Name"] a') as HTMLAnchorElement;
    const track = vi.spyOn(TestBed.inject(AnalyticsService), 'track');
    // jsdom cannot navigate and logs an error when a same-tab link is followed.
    link.addEventListener('click', event => event.preventDefault());

    link.click();
    pressEnter(link);

    expect(track).toHaveBeenCalledExactlyOnceWith('Document Downloaded', expect.objectContaining({ document_id: 'doc1' }));
    expect(open).not.toHaveBeenCalled();
  });
});
