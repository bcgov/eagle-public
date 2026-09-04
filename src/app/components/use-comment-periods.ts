import { useQuery } from '@tanstack/react-query';
import { getAllByProjectId } from 'app/api/commentperiod';
import type { CommentPeriod } from 'app/models/commentperiod';

/**
 * Legacy periods carry the period name inside the instructions HTML, so it is pulled out and the
 * raw text kept as the description. Deduplicated by id, and by MET URL for ENGAGE-hosted periods,
 * since the same engagement can be synced into more than one period.
 */
function normalize(raw: CommentPeriod[]): CommentPeriod[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  return raw
    .map((period) => {
      const fullText = period.instructions
        ? period.instructions
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '';
      const match = fullText.match(/Comment Period on the (.*?) for /);
      period.additionalText = period.additionalText || fullText || period.informationLabel;
      period.instructions = match ? match[1] : '';
      return period;
    })
    .filter((period) => {
      if (seenIds.has(period._id)) return false;
      seenIds.add(period._id);
      if (period.isMet && period.metURL) {
        if (seenUrls.has(period.metURL)) return false;
        seenUrls.add(period.metURL);
      }
      return true;
    });
}

/** eagle-api answers a bare array or a `{ totalCount, data }` envelope; both become a list. */
export function periodsOf(res: unknown): CommentPeriod[] {
  if (Array.isArray(res)) return res as CommentPeriod[];
  return (res as { data?: CommentPeriod[] })?.data ?? [];
}

/** Comment periods of a project or project notification, normalized and deduplicated. */
export function useCommentPeriods(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ['commentPeriods', projectId],
    enabled: !!projectId && enabled,
    queryFn: async () => normalize(periodsOf(await getAllByProjectId(projectId))),
  });
}
