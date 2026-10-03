import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CommentPeriodService } from './commentperiod.service';
import { ApiService } from './api';
import { envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

const PROJECT = '60f078d3332ebd0022a39224';
const PERIOD = '6123456789abcdef01234567';

describe('CommentPeriodService DEMI reads', () => {
  let httpMock: HttpTestingController;
  let service: CommentPeriodService;

  beforeEach(() => {
    httpMock = setupDemiApi();
    service = TestBed.inject(CommentPeriodService);
  });

  afterEach(() => httpMock.verify());

  describe('getAllByProjectId()', () => {
    it("asks for one project's periods, newest first, in one page", async () => {
      const result = firstValueFrom(service.getAllByProjectId(PROJECT));
      const req = searchRequest(httpMock, 'CommentPeriod');
      req.flush(envelope([]));
      await result;
      expect(req.request.url).toContain(`&and[project]=${PROJECT}`);
      expect(req.request.url).toContain('&sortBy=-dateStarted');
      expect(req.request.url).toContain('&pageSize=250');
    });

    it('returns the periods as CommentPeriod rows', async () => {
      const result = firstValueFrom(service.getAllByProjectId(PROJECT));
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([
        { _id: PERIOD, informationLabel: 'Application', dateStarted: '2026-01-01', dateCompleted: '2026-02-01' },
      ]));
      const res: any = await result;
      expect(res.totalCount).toBe(1);
      expect(res.data[0].informationLabel).toBe('Application');
    });

    it('drops fields the cards must not show', async () => {
      const result = firstValueFrom(service.getAllByProjectId(PROJECT));
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([{ _id: PERIOD, additionalText: 'Admin only' }]));
      const res: any = await result;
      expect(res.data[0].additionalText).toBeNull();
    });
  });

  describe('getById()', () => {
    it('reads one period by and[_id]', async () => {
      const result = firstValueFrom(service.getById(PERIOD));
      const req = searchRequest(httpMock, 'CommentPeriod');
      req.flush(envelope([{ _id: PERIOD }]));
      await result;
      expect(req.request.url).toContain(`&and[_id]=${PERIOD}`);
      expect(req.request.url).toContain('&pageSize=1');
    });

    it('keeps the comment tip the comment form shows', async () => {
      const result = firstValueFrom(service.getById(PERIOD));
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([{ _id: PERIOD, commentTip: 'Be specific' }]));
      expect((await result).commentTip).toBe('Be specific');
    });

    it('keeps the ENGAGE link the period page opens', async () => {
      const result = firstValueFrom(service.getById(PERIOD));
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([{ _id: PERIOD, isMet: true, metURL: 'https://engage.eao.gov.bc.ca/site-c' }]));
      const period = await result;
      expect(period.metURL).toBe('https://engage.eao.gov.bc.ca/site-c');
      expect(period.isEngage).toBe(true);
    });

    it('drops the admin fields stored on the record', async () => {
      const result = firstValueFrom(TestBed.inject(ApiService).getPeriod(PERIOD));
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([{ _id: PERIOD, metURLAdmin: 'https://admin' }]));
      expect((await result)[0]).not.toHaveProperty('metURLAdmin');
    });

    it('answers null when DEMI has no such period', async () => {
      const result = firstValueFrom(service.getById(PERIOD));
      searchRequest(httpMock, 'CommentPeriod').flush(envelope([]));
      expect(await result).toBeNull();
    });
  });
});
