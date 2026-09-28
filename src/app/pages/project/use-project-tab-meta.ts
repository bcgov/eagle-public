import { useQuery } from '@tanstack/react-query';
import { isOpen } from 'app/api/commentperiod';
import { notificationQueryOptions } from 'app/api/notification';
import { projectUpdatesQueryOptions } from 'app/api/updates';
import { useTable } from 'app/components/table/use-table';
import type { NotificationFacts, Project } from 'app/models/project';
import { Constants } from 'app/utils/constants';
import { useDocTabProbes } from './use-doc-tab-probes';
import { useEngagementPeriods } from './use-engagement-periods';

export interface ProjectTab {
  /** Route segment under `/p/:projId` or `/pn/:projId`. */
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

const OVERVIEW_TAB: ProjectTab = { key: 'overview', label: 'Overview', show: true };

/** The Engagement tab, counting the open periods. */
function useEngagementTab(projId: string, notification?: NotificationFacts): ProjectTab {
  const { periods, isPending } = useEngagementPeriods(projId, notification);
  const open = periods?.filter(isOpen).length ?? 0;
  return {
    key: 'engagement',
    label: 'Engagement',
    count: open ? `${open} open` : undefined,
    countPending: isPending,
    show: true,
  };
}

/** The Documents tab, counting every document filed under the id. */
function useDocumentsTab(projId: string): ProjectTab {
  const documents = useTable('projectTabDocuments', {
    ...COUNT_QUERY,
    dataset: 'Document',
    enabled: !!projId,
    queryModifiers: { project: projId },
  });
  return {
    key: 'documents',
    label: 'Documents',
    count: documents.totalListItems ? documents.totalListItems.toLocaleString('en-CA') : undefined,
    countPending: !documents.totalListItems && documents.loading,
    show: true,
  };
}

/** A project notification has no updates, decisions or compliance record, so only these three. */
export function useNotificationTabMeta(id: string): ProjectTab[] {
  // Same query key the page runs, so this reads its cache rather than fetching again.
  const { data: notification, isPending } = useQuery(notificationQueryOptions(id));
  const engagement = useEngagementTab(id, notification?.notification);
  return [
    OVERVIEW_TAB,
    { ...engagement, countPending: engagement.countPending || isPending },
    useDocumentsTab(id),
  ];
}

/** The tab strip's labels, counts and visibility rules. */
export function useProjectTabMeta(
  projId: string,
  lists: any[],
  project: Project | null,
): ProjectTab[] {
  const probes = useDocTabProbes(projId, lists);

  // The visible list, not a raw count: a draft row must not open the tab.
  const { data: updates, isPending: updatesPending } = useQuery(projectUpdatesQueryOptions(projId));

  const engagement = useEngagementTab(projId);
  const documents = useDocumentsTab(projId);

  const decision = project?.eacDecision?.name;

  return [
    OVERVIEW_TAB,
    {
      key: 'updates',
      label: 'Updates',
      count: updates?.length ? String(updates.length) : undefined,
      countPending: updatesPending,
      // Held in the strip while the list loads, so it does not pop in after its neighbours.
      show: updatesPending || !!updates?.length,
    },
    engagement,
    documents,
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
