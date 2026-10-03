import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { DocumentService } from './document.service';
import { envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

describe('DocumentService DEMI reads', () => {
  let httpMock: HttpTestingController;
  let service: DocumentService;

  beforeEach(() => {
    httpMock = setupDemiApi();
    service = TestBed.inject(DocumentService);
  });

  afterEach(() => httpMock.verify());

  describe('getByMultiId()', () => {
    it('asks the Document dataset for the ids, pipe-separated, in one page', async () => {
      const result = firstValueFrom(service.getByMultiId(['d1', 'd2', 'd3']));
      const req = searchRequest(httpMock, 'Document');
      req.flush(envelope([]));
      await result;
      expect(req.request.url).toContain('&docIds=d1|d2|d3&');
      expect(req.request.url).toContain('&pageSize=3&');
    });

    it('labels a document with no original name by its file name', async () => {
      const result = firstValueFrom(service.getByMultiId(['d1']));
      searchRequest(httpMock, 'Document').flush(envelope([{ _id: 'd1', documentFileName: 'Report.pdf' }]));
      expect((await result)[0].internalOriginalName).toBe('Report.pdf');
    });

    it('keeps a stored original name', async () => {
      const result = firstValueFrom(service.getByMultiId(['d1']));
      searchRequest(httpMock, 'Document').flush(envelope([{ _id: 'd1', internalOriginalName: 'orig.pdf', documentFileName: 'Report.pdf' }]));
      expect((await result)[0].internalOriginalName).toBe('orig.pdf');
    });

    it('drops fields outside the projection', async () => {
      const result = firstValueFrom(TestBed.inject(ApiService).getDocumentsByMultiId(['d1']));
      searchRequest(httpMock, 'Document').flush(envelope([{ _id: 'd1', read: ['staff'], displayName: 'A' }]));
      expect((await result)[0]).not.toHaveProperty('read');
    });
  });

  describe('getById()', () => {
    it('reads one document through the same docIds query', async () => {
      const result = firstValueFrom(service.getById('d1', true));
      const req = searchRequest(httpMock, 'Document');
      expect(req.request.url).toContain('&docIds=d1&');
      req.flush(envelope([{ _id: 'd1', documentSource: 'COMMENT', displayName: 'A' }]));
      expect((await result).documentSource).toBe('COMMENT');
    });
  });
});
