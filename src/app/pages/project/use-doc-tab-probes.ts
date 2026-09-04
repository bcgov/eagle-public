import { useQueries } from '@tanstack/react-query';
import { getSearchResults } from 'app/api/search';
import { logger } from 'app/config/logging';
import { Constants } from 'app/utils/constants';
import { createProjectTabModifiers, extractFromSearchResults } from 'app/utils/utils';

/** Document kinds a project may or may not hold. */
const PROBE_KEYS = [
  Constants.optionalProjectDocTabs.APPLICATION,
  Constants.optionalProjectDocTabs.CERTIFICATE,
  Constants.optionalProjectDocTabs.AMENDMENT,
  Constants.optionalProjectDocTabs.COMPLIANCE,
];

export interface DocTabProbes {
  /** Per kind: whether the project has any, `undefined` until that probe's first attempt settles. */
  has: Record<string, boolean | undefined>;
  /** True only while a first attempt is still in flight; a retry does not hold callers back. */
  probing: boolean;
}

/**
 * One 1-result search per document kind, shared by the tab strip and the Documents sub-tabs
 * through the `project-tab-has-documents` key, so revisiting a tab does not re-ask.
 */
export function useDocTabProbes(projId: string, lists: any[]): DocTabProbes {
  const results = useQueries({
    queries: PROBE_KEYS.map((key) => ({
      queryKey: ['project-tab-has-documents', projId, key],
      enabled: !!projId && lists.length > 0,
      queryFn: async () => {
        const response = await getSearchResults(
          '',
          'Document',
          [{ name: 'project', value: projId }],
          1,
          1,
          '',
          createProjectTabModifiers(key, lists),
          true,
          '',
        );
        const results = extractFromSearchResults(response ?? []);
        if (!results) {
          // getSearchResults turns any non-2xx into `null`, so a 502 and a project with no
          // documents of this kind look the same. Throwing lets TanStack retry; returning `false`
          // would cache one bad gateway as "no documents" for the rest of the visit.
          logger.error(`Could not determine whether the ${key} segment has documents`, 'DocsProbe');
          throw new Error(`${key} probe failed`);
        }
        return results.length > 0;
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
