import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';

import { CommentsComponent } from './comments.component';
import { ToastService } from '../services/toast.service';
import { SEARCH, setupDemiApi } from '../services/demi-api.spec-helper';

const DOWNLOAD = `${SEARCH}/documents/doc1/download?redirect=1`;

/** Attachment downloads run through the real ApiService; only the HEAD check answers vary. */
describe('CommentsComponent attachment download', () => {
  let httpMock: HttpTestingController;
  let show: ReturnType<typeof vi.fn>;

  function setup(): CommentsComponent {
    show = vi.fn();
    httpMock = setupDemiApi([
      { provide: ToastService, useValue: { show } },
      // No route ids, so the constructor loads nothing.
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
      { provide: Router, useValue: { navigate: vi.fn(), url: '' } },
      { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
      { provide: NgbModal, useValue: {} },
    ]);
    return TestBed.runInInjectionContext(() => new CommentsComponent());
  }

  function frame(): HTMLIFrameElement | null {
    return document.body.querySelector(`iframe[src="${DOWNLOAD}"]`);
  }

  afterEach(() => {
    httpMock.verify();
    frame()?.remove();
  });

  it('checks the file, then starts the download and says so', async () => {
    const done = setup().downloadDocument({ _id: 'doc1', displayName: 'a.pdf' });
    const req = httpMock.expectOne(DOWNLOAD);
    expect(req.request.method).toBe('HEAD');
    req.flush(null);
    await done;
    expect(frame()).not.toBeNull();
    expect(show).toHaveBeenCalledWith('Starting download', '', { duration: 2000, type: 'info' });
  });

  it('shows an error and starts nothing when the file is missing', async () => {
    const done = setup().downloadDocument({ _id: 'doc1', displayName: 'a.pdf' });
    httpMock.expectOne(DOWNLOAD).flush(null, { status: 404, statusText: 'Not Found' });
    await done;
    expect(frame()).toBeNull();
    expect(show).toHaveBeenCalledExactlyOnceWith('Error opening document! Please try again later', '', { duration: 2000, type: 'error' });
  });

  it('shows an error when the check cannot reach the server', async () => {
    const done = setup().downloadDocument({ _id: 'doc1', displayName: 'a.pdf' });
    httpMock.expectOne(DOWNLOAD).error(new ProgressEvent('error'));
    await done;
    expect(frame()).toBeNull();
    expect(show).toHaveBeenCalledExactlyOnceWith('Error opening document! Please try again later', '', { duration: 2000, type: 'error' });
  });
});
