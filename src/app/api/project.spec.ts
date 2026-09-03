import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as api from './api';
import * as search from './search';
import * as project from './project';
import { logger } from 'app/config/logging';

vi.mock('./api');
vi.mock('./search');

describe('project', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  describe('getAll()', () => {
    // demi-api answers non-2xx when a search fails, and search.getSearchResults turns any
    // failure into a single `null`. getAll used to dereference
    // res[0].data.meta[0].searchResultsTotal on that, throwing a TypeError that bounced the
    // visitor off /projects onto the home page.
    it('degrades a failed search to an empty result set instead of throwing', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue(null);

      const result = await project.getAll(1, 10);

      expect(result.data).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('degrades a response with no meta block to an empty result set', async () => {
      // A well-formed but meta-less envelope: meta[0] is what blows up.
      vi.mocked(search.getSearchResults).mockResolvedValue([{ data: { searchResults: [] } }]);

      const result = await project.getAll(1, 10);

      expect(result.data).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('logs the failure rather than surfacing it silently', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue(null);

      await project.getAll(1, 10);

      expect(logger.error).toHaveBeenCalled();
    });

    it('still reports the total count for a well-formed response', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue([
        { data: { searchResults: [{ _id: 'abc' }], meta: [{ searchResultsTotal: 42 }] } },
      ]);

      const result = await project.getAll(1, 10);

      expect(result.totalCount).toBe(42);
      expect(result.data.length).toBe(1);
    });
  });

  describe('getAllFull()', () => {
    it('resolves to an empty project list rather than erroring when the search fails', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue(null);

      await expect(project.getAllFull(1, 10)).resolves.toEqual([]);
    });
  });

  describe('getById()', () => {
    it('returns the project the api answered with', async () => {
      vi.mocked(api.getProject).mockResolvedValue([
        { _id: '58851197aaecd9001b8227cc', description: 'Test project' },
      ] as any);

      const result = await project.getById('58851197aaecd9001b8227cc', true);

      expect(result._id).toEqual('58851197aaecd9001b8227cc');
      expect(api.getProject).toHaveBeenCalled();
    });

    it('returns null when the api answers with no project', async () => {
      vi.mocked(api.getProject).mockResolvedValue([] as any);

      expect(await project.getById('missing', true)).toBeNull();
    });
  });
});
