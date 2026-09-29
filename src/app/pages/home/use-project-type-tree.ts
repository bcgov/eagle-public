import { useQuery } from '@tanstack/react-query';
import { allProjectsQueryOptions } from 'app/api/project';
import { buildTypeTree, type TypeNode } from './types-tree';

export interface ProjectTypeTree {
  /** `null` while the list loads. */
  tree: TypeNode[] | null;
  total: number;
  /** `getAll` turns a failed search into an empty list, so no projects at all means the read failed. */
  failed: boolean;
}

/** Every public project grouped by type and sub-type, from the list /projects already caches. */
export function useProjectTypeTree(): ProjectTypeTree {
  // `buildTypeTree` is module-level, so `select` keeps one identity and the tree is memoised.
  const { data, isError } = useQuery({ ...allProjectsQueryOptions(), select: buildTypeTree });
  if (!data) return { tree: null, total: 0, failed: isError };
  return {
    tree: data,
    total: data.reduce((sum, t) => sum + t.count, 0),
    failed: data.length === 0,
  };
}
