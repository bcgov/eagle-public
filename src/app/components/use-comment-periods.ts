import { useQuery } from '@tanstack/react-query';
import { commentPeriodsQueryOptions } from 'app/api/commentperiod';
import { CommentPeriod } from 'app/models/commentperiod';

/**
 * Legacy periods carry the period name inside the instructions HTML, so it is pulled out and the
 * raw text kept as the description. Deduplicated by id, and by MET URL for ENGAGE-hosted periods,
 * since the same engagement can be synced into more than one period.
 *
 * Copies rather than edits: this runs as a `select` over rows other readers share.
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
      return new CommentPeriod({
        ...period,
        additionalText: period.additionalText || fullText || period.informationLabel,
        instructions: match ? match[1] : '',
      });
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

/** Comment periods of a project or project notification, normalized and deduplicated. */
export function useCommentPeriods(projectId: string, enabled = true) {
  return useQuery({
    ...commentPeriodsQueryOptions(projectId),
    enabled: !!projectId && enabled,
    select: normalize,
  });
}
