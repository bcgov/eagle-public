import { useQueries } from '@tanstack/react-query';
import { documentFilters, readDocuments } from 'app/api/document';
import { Constants } from 'app/utils/constants';
import { createProjectTabModifiers } from 'app/utils/utils';

/** Document kinds a project may or may not hold. */
const PROBE_KEYS = [
  Constants.optionalProjectDocTabs.APPLICATION,
  Constants.optionalProjectDocTabs.CERTIFICATE,
  Constants.optionalProjectDocTabs.AMENDMENT,
  Constants.optionalProjectDocTabs.COMPLIANCE,
  Constants.optionalProjectDocTabs.MANAGEMENT_PLAN,
];

export interface DocTabProbes {
  /** Per kind: whether the project has any, `undefined` until that probe's first attempt settles. */
  has: Record<string, boolean | undefined>;
  /** True only while a first attempt is still in flight; a retry does not hold callers back. */
  probing: boolean;
}

/**
 * One 1-row read per document kind, shared by the tab strip and the Documents sub-tabs
 * through the `project-tab-has-documents` key, so revisiting a tab does not re-ask.
 */
export function useDocTabProbes(projId: string, lists: any[]): DocTabProbes {
  const results = useQueries({
    queries: PROBE_KEYS.map((key) => ({
      queryKey: ['project-tab-has-documents', projId, key],
      enabled: !!projId && lists.length > 0,
      // A failed read throws, so TanStack retries rather than caching a bad gateway as "none".
      queryFn: async () => {
        const { total } = await readDocuments({
          projId,
          page: 1,
          pageSize: 1,
          filters: documentFilters(createProjectTabModifiers(key, lists)),
        });
        return total > 0;
      },
    })),
  });

  return {
    has: Object.fromEntries(PROBE_KEYS.map((key, index) => [key, results[index]?.data])),
    // A disabled query (no lists) and a retrying one both report `isPending`, and neither should
    // hold the segments back.
    probing:
      lists.length > 0 && results.some((result) => result.isPending && result.failureCount === 0),
  };
}
