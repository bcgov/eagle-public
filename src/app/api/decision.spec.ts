import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as api from './api';
import * as documentApi from './document';
import * as decision from './decision';
import { Document } from 'app/models/document';

vi.mock('./api');
vi.mock('./document');

describe('decision', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(documentApi.getAllByDecisionId).mockResolvedValue([new Document({ _id: '11' })]);
  });

  describe('getByApplicationId', () => {
    it('returns null when no decision is returned by the API', async () => {
      vi.mocked(api.getDecisionByAppId).mockResolvedValue([]);
      expect(await decision.getByApplicationId('1', true)).toBeNull();
    });

    it('returns one Decision with documents when API returns data', async () => {
      vi.mocked(api.getDecisionByAppId).mockResolvedValue([{ _id: '1' }] as any);

      const result = await decision.getByApplicationId('1', true);

      expect(result._id).toEqual('1');
      expect(result.documents).toEqual([new Document({ _id: '11' })]);
      expect(documentApi.getAllByDecisionId).toHaveBeenCalledWith('1');
    });

    it('returns only the first Decision when multiple are returned', async () => {
      vi.mocked(api.getDecisionByAppId).mockResolvedValue([{ _id: '2' }, { _id: '3' }, { _id: '4' }] as any);

      expect((await decision.getByApplicationId('1', true))._id).toEqual('2');
    });

    it('propagates API errors', async () => {
      vi.mocked(api.getDecisionByAppId).mockRejectedValue(new Error('API Error'));

      await expect(decision.getByApplicationId('1', true)).rejects.toThrow('API Error');
    });
  });

  describe('getById', () => {
    it('returns null when no decision is returned by the API', async () => {
      vi.mocked(api.getDecision).mockResolvedValue([]);
      expect(await decision.getById('1', true)).toBeNull();
    });

    it('returns one Decision with documents when API returns data', async () => {
      vi.mocked(api.getDecision).mockResolvedValue([{ _id: '1' }] as any);

      const result = await decision.getById('1', true);

      expect(result._id).toEqual('1');
      expect(documentApi.getAllByDecisionId).toHaveBeenCalledWith('1');
    });

    it('propagates API errors', async () => {
      vi.mocked(api.getDecision).mockRejectedValue(new Error('API Error'));

      await expect(decision.getById('1', true)).rejects.toThrow('API Error');
    });
  });
});
