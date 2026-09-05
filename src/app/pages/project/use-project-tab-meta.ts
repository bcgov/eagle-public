import { isOpen } from 'app/api/commentperiod';
import { useTable } from 'app/components/table/use-table';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import type { Project } from 'app/models/project';
import { Constants } from 'app/utils/constants';
import { useDocTabProbes } from './use-doc-tab-probes';

export interface ProjectTab {
  /** Route segment under `/p/:projId`. */
  key: string;
  label: string;
  /** Rendered after the label; absent when there is nothing worth counting. */
  count?: string;
  /** The count's query has not answered yet, so the strip holds its place. */
  countPending?: boolean;
  show: boolean;
}

/** Counts come from a 1-result search: the strip needs the total, never the rows. */
const COUNT_QUERY = { currentPage: 1, pageSize: 1, sortBy: '' };

/** A project still in assessment has no decision to show. */
const UNDECIDED = 'In Progress';

/** The tab strip's labels, counts and visibility rules. */
export function useProjectTabMeta(
  projId: string,
  lists: any[],
  project: Project | null,
): ProjectTab[] {
  const probes = useDocTabProbes(projId, lists);

  const updates = useTable('projectTabUpdates', {
    ...COUNT_QUERY,
    dataset: 'RecentActivity',
    enabled: !!projId,
    queryModifiers: { project: projId },
  });

  const documents = useTable('projectTabDocuments', {
    ...COUNT_QUERY,
    dataset: 'Document',
    enabled: !!projId,
    queryModifiers: { project: projId },
  });

  const { data: commentPeriods, isPending: periodsPending } = useCommentPeriods(projId);
  const open = commentPeriods?.filter(isOpen).length ?? 0;

  const decision = project?.eacDecision?.name;

  return [
    { key: 'overview', label: 'Overview', show: true },
    {
      key: 'updates',
      label: 'Updates',
      count: updates.totalListItems ? String(updates.totalListItems) : undefined,
      countPending: !updates.totalListItems && updates.loading,
      show: true,
    },
    {
      key: 'engagement',
      label: 'Engagement',
      count: open ? `${open} open` : undefined,
      countPending: periodsPending,
      show: true,
    },
    {
      key: 'documents',
      label: 'Documents',
      count: documents.totalListItems
        ? documents.totalListItems.toLocaleString('en-CA')
        : undefined,
      countPending: !documents.totalListItems && documents.loading,
      show: true,
    },
    {
      key: 'decisions',
      label: 'Decisions',
      show:
        (!!decision && decision !== UNDECIDED) ||
        probes.has[Constants.optionalProjectDocTabs.CERTIFICATE] === true,
    },
    {
      key: 'compliance',
      label: 'Compliance',
      show: probes.has[Constants.optionalProjectDocTabs.COMPLIANCE] === true,
    },
  ];
}
