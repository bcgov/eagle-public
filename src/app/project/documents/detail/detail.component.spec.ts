import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { DocumentDetailComponent } from './detail.component';
import { ToastService } from '../../../services/toast.service';
import { StorageService } from '../../../services/storage.service';
import { SEARCH, setupDemiApi } from '../../../services/demi-api.spec-helper';

const DOWNLOAD = `${SEARCH}/documents/doc1/download?redirect=1`;

/** The Download action runs through the real ApiService; only the HEAD check answers vary. */
describe('DocumentDetailComponent download', () => {
  let httpMock: HttpTestingController;
  let show: ReturnType<typeof vi.fn>;

  function clickDownload(): void {
    show = vi.fn();
    httpMock = setupDemiApi([
      provideRouter([]),
      { provide: ToastService, useValue: { show } },
      { provide: ActivatedRoute, useValue: { data: of({ document: { _id: 'doc1', displayName: 'a.pdf', labels: [] } }) } },
      { provide: StorageService, useValue: { state: { currentProject: { data: null } } } },
    ]);
    const fixture = TestBed.createComponent(DocumentDetailComponent);
    fixture.detectChanges();
    const buttons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button.dropdown-item'));
    buttons.find(b => b.textContent?.trim() === 'Download')!.click();
  }

  function frame(): HTMLIFrameElement | null {
    return document.body.querySelector(`iframe[src="${DOWNLOAD}"]`);
  }

  // The download leaves a one-minute timer to remove its frame.
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    httpMock.verify();
    frame()?.remove();
    vi.useRealTimers();
  });

  it('says the download started once the file check passes', async () => {
    clickDownload();
    httpMock.expectOne(DOWNLOAD).flush(null);
    await vi.waitFor(() => expect(show).toHaveBeenCalledWith('Starting download', '', { duration: 2000, type: 'info' }));
    expect(frame()).not.toBeNull();
  });

  it('shows an error and starts nothing when the file is missing', async () => {
    clickDownload();
    httpMock.expectOne(DOWNLOAD).flush(null, { status: 404, statusText: 'Not Found' });
    await vi.waitFor(() => expect(show).toHaveBeenCalledExactlyOnceWith('Error opening document! Please try again later', '', { duration: 2000, type: 'error' }));
    expect(frame()).toBeNull();
  });
});
