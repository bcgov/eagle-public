import { skipToken, useQuery } from '@tanstack/react-query';
import { ALL_PROJECTS_TOTAL_KEY, allProjectsQueryOptions } from 'app/api/project';
import { buildTypeTree, type TypeNode, type TypeTreeSource } from './types-tree';

export interface ProjectTypeTree {
  /** `null` while the list loads or waits to be enabled. */
  tree: TypeNode[] | null;
  total: number;
  /** The read failed, or it answered no projects at all. */
  failed: boolean;
  /** Set when the search holds more projects than it sent: `shown` rows of `of`. */
  truncated: { shown: number; of: number } | null;
}

// Module-level, so `select` keeps one identity and the tree is memoised.
const selectTree = (projects: readonly TypeTreeSource[]) => ({
  tree: buildTypeTree(projects),
  rows: projects.length,
});

/** Every public project grouped by type and sub-type, from the list /projects already caches. */
export function useProjectTypeTree(enabled = true): ProjectTypeTree {
  const { data, isError } = useQuery({ ...allProjectsQueryOptions(), select: selectTree, enabled });
  // Written by the list's own fetch; it never fetches by itself.
  const { data: searchTotal } = useQuery<number>({
    queryKey: ALL_PROJECTS_TOTAL_KEY,
    queryFn: skipToken,
  });
  if (!data) return { tree: null, total: 0, failed: isError, truncated: null };
  const { tree, rows } = data;
  return {
    tree,
    total: tree.reduce((sum, t) => sum + t.count, 0),
    failed: tree.length === 0,
    truncated: searchTotal && searchTotal > rows ? { shown: rows, of: searchTotal } : null,
  };
}
