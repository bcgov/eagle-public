import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as api from './api';
import * as search from './search';
import * as project from './project';
import { logger } from 'app/config/logging';
import { makeQueryClient } from '../../test-utils';

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

  describe('allProjectsQueryOptions()', () => {
    it('throws on a failed search, so the query caches nothing', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue(null);
      const client = makeQueryClient();

      await expect(client.fetchQuery(project.allProjectsQueryOptions())).rejects.toThrow(
        'no usable results',
      );
      expect(client.getQueryData(['projects', 'all'])).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('caches the rows under the shared key and the search total beside them', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue([
        {
          data: {
            searchResults: [{ _id: 'a' }, { _id: 'b' }],
            meta: [{ searchResultsTotal: 1500 }],
          },
        },
      ]);
      const client = makeQueryClient({ gcTime: Infinity });

      const rows = await client.fetchQuery(project.allProjectsQueryOptions());

      expect(rows.map((p) => p._id)).toEqual(['a', 'b']);
      expect(client.getQueryData(['projects', 'all'])).toBe(rows);
      expect(client.getQueryData(project.ALL_PROJECTS_TOTAL_KEY)).toBe(1500);
    });
  });

  describe('searchProjectIds()', () => {
    it('returns the ids in the order demi-search ranked them', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue([
        {
          data: {
            searchResults: [{ _id: 'p2' }, { _id: 'p1' }],
            meta: [{ searchResultsTotal: 2 }],
          },
        },
      ]);

      expect(await project.searchProjectIds('line')).toEqual(['p2', 'p1']);
      // One unpopulated page, in score order (no sort field).
      expect(search.getSearchResults).toHaveBeenCalledWith(
        'line',
        'Project',
        [],
        1,
        project.KEYWORD_PAGE_SIZE,
        '',
        {},
        false,
        '',
        {},
        '',
      );
    });

    it('throws on a failed search so the caller can retry and say so', async () => {
      vi.mocked(search.getSearchResults).mockResolvedValue(null);

      await expect(project.searchProjectIds('line')).rejects.toThrow('no usable results');
    });

    it('warns when more projects match than one page holds', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      vi.mocked(search.getSearchResults).mockResolvedValue([
        {
          data: {
            searchResults: [{ _id: 'p1' }],
            meta: [{ searchResultsTotal: project.KEYWORD_PAGE_SIZE + 1 }],
          },
        },
      ]);

      await project.searchProjectIds('mine');

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('matched 501 projects'), 'project');
    });

    it('stays quiet when every match fits on the page', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      vi.mocked(search.getSearchResults).mockResolvedValue([
        {
          data: {
            searchResults: [{ _id: 'p1' }],
            meta: [{ searchResultsTotal: project.KEYWORD_PAGE_SIZE }],
          },
        },
      ]);

      await project.searchProjectIds('mine');

      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('getById()', () => {
    it('returns the project DEMI answered with', async () => {
      vi.mocked(api.getDemiProject).mockResolvedValue({
        eagleId: '58851197aaecd9001b8227cc',
        description: 'Test project',
      });

      const result = await project.getById('58851197aaecd9001b8227cc', true);

      expect(result._id).toEqual('58851197aaecd9001b8227cc');
      expect(api.getDemiProject).toHaveBeenCalledWith('58851197aaecd9001b8227cc');
    });

    it('returns null when DEMI holds no such project', async () => {
      vi.mocked(api.getDemiProject).mockResolvedValue(null);

      expect(await project.getById('missing', true)).toBeNull();
    });
  });
});
