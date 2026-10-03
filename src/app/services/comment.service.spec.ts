import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CommentService } from './comment.service';
import { envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

const PERIOD = '6123456789abcdef01234567';
const COMMENT = '6223456789abcdef01234567';

describe('CommentService DEMI reads', () => {
  let httpMock: HttpTestingController;
  let service: CommentService;

  beforeEach(() => {
    httpMock = setupDemiApi();
    service = TestBed.inject(CommentService);
  });

  afterEach(() => httpMock.verify());

  describe('getByPeriodId()', () => {
    it("asks for one page of a period's comments, newest first", async () => {
      const result = firstValueFrom(service.getByPeriodId(PERIOD, 2, 10));
      const req = searchRequest(httpMock, 'Comment');
      req.flush(envelope([]));
      await result;
      expect(req.request.url).toContain(`&and[period]=${PERIOD}`);
      expect(req.request.url).toContain('&sortBy=-commentId');
      // Page 2 of the table is page 1 zero-based on the wire.
      expect(req.request.url).toContain('&pageNum=1&pageSize=10');
    });

    it('returns the comments and the total for the whole period', async () => {
      const result = firstValueFrom(service.getByPeriodId(PERIOD, 1, 10));
      searchRequest(httpMock, 'Comment').flush(envelope([{ _id: COMMENT, author: 'Pat' }], 57));
      const res: any = await result;
      expect(res.totalCount).toBe(57);
      expect(res.currentComments[0].author).toBe('Pat');
    });
  });

  describe('getCountById()', () => {
    it("reads the period's comment total from the search meta", async () => {
      const result = firstValueFrom(service.getCountById(PERIOD));
      const req = searchRequest(httpMock, 'Comment');
      expect(req.request.url).toContain(`&and[period]=${PERIOD}`);
      req.flush(envelope([{ _id: COMMENT }], 31));
      expect(await result).toBe(31);
    });
  });

  describe('getById()', () => {
    it('reads one comment by and[_id]', async () => {
      const result = firstValueFrom(service.getById(COMMENT));
      const req = searchRequest(httpMock, 'Comment');
      expect(req.request.url).toContain(`&and[_id]=${COMMENT}`);
      req.flush(envelope([{ _id: COMMENT, author: 'Pat', documents: [] }]));
      expect((await result).author).toBe('Pat');
    });

    it("loads the comment's attachments from the Document dataset", async () => {
      const result = firstValueFrom(service.getById(COMMENT));
      searchRequest(httpMock, 'Comment').flush(envelope([{ _id: COMMENT, documents: ['d1', 'd2'] }]));
      const docs = searchRequest(httpMock, 'Document');
      expect(docs.request.url).toContain('&docIds=d1|d2&');
      docs.flush(envelope([{ _id: 'd1', documentFileName: 'a.pdf' }, { _id: 'd2', displayName: 'B' }]));
      expect((await result).documentsList.map((doc: any) => doc.internalOriginalName)).toEqual(['a.pdf', 'B']);
    });

    it('answers null when DEMI has no such comment', async () => {
      const result = firstValueFrom(service.getById(COMMENT));
      searchRequest(httpMock, 'Comment').flush(envelope([]));
      expect(await result).toBeNull();
    });
  });
});
