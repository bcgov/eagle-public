import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as api from './api';
import * as project from './project';
import { makeQueryClient } from '../../test-utils';

vi.mock('./api');

describe('project', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('allProjectsQueryOptions()', () => {
    it('throws on a failed read, so the query caches nothing', async () => {
      vi.mocked(api.listNative).mockRejectedValue(new Error('500 - down'));
      const client = makeQueryClient();

      await expect(client.fetchQuery(project.allProjectsQueryOptions())).rejects.toThrow('500');
      expect(client.getQueryData(['projects', 'all'])).toBeUndefined();
    });

    it('caches the rows under the shared key and the DEMI total beside them', async () => {
      vi.mocked(api.listNative).mockResolvedValue({
        rows: [{ eagleId: 'a' }, { eagleId: 'b' }],
        total: 2,
      });
      const client = makeQueryClient({ gcTime: Infinity });

      const rows = await client.fetchQuery(project.allProjectsQueryOptions());

      expect(rows.map((p) => p._id)).toEqual(['a', 'b']);
      expect(client.getQueryData(['projects', 'all'])).toBe(rows);
      expect(client.getQueryData(project.ALL_PROJECTS_TOTAL_KEY)).toBe(2);
    });

    it('retries a failed full-list read once, not three times', async () => {
      vi.mocked(api.listNative).mockRejectedValue(new Error('500 - down'));
      const client = makeQueryClient({ retry: 3, retryDelay: 0 });

      await expect(client.fetchQuery(project.allProjectsQueryOptions())).rejects.toThrow();

      expect(api.listNative).toHaveBeenCalledTimes(2);
    });

    it('keeps the total outside the list key, so invalidating the list leaves it alone', async () => {
      vi.mocked(api.listNative).mockResolvedValue({ rows: [{ eagleId: 'a' }], total: 1 });
      const client = makeQueryClient({ gcTime: Infinity });
      await client.fetchQuery(project.allProjectsQueryOptions());

      await client.invalidateQueries({ queryKey: ['projects', 'all'] });

      expect(client.getQueryState(['projects', 'all'])?.isInvalidated).toBe(true);
      expect(client.getQueryState(project.ALL_PROJECTS_TOTAL_KEY)?.isInvalidated).toBe(false);
    });
  });

  describe('searchProjectIds()', () => {
    it('cancels through the caller signal', async () => {
      vi.mocked(api.listNative).mockResolvedValue({ rows: [{ eagleId: 'p1' }], total: 1 });
      const { signal } = new AbortController();

      await project.searchProjectIds('line', signal);

      expect(api.listNative).toHaveBeenCalledWith('projects', expect.anything(), signal);
    });
  });

  describe('getById()', () => {
    it('returns the project DEMI answered with', async () => {
      vi.mocked(api.getDemiProject).mockResolvedValue({
        eagleId: '58851197aaecd9001b8227cc',
        description: 'Test project',
      });

      const result = await project.getById('58851197aaecd9001b8227cc');

      expect(result?._id).toEqual('58851197aaecd9001b8227cc');
      expect(api.getDemiProject).toHaveBeenCalledWith('58851197aaecd9001b8227cc');
    });

    it('returns null when DEMI holds no such project', async () => {
      vi.mocked(api.getDemiProject).mockResolvedValue(null);

      expect(await project.getById('missing')).toBeNull();
    });
  });
});
