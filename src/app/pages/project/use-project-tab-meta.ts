import { useQuery } from '@tanstack/react-query';
import { isOpen } from 'app/api/commentperiod';
import { notificationQueryOptions } from 'app/api/notification';
import { projectUpdatesQueryOptions } from 'app/api/updates';
import { useTable } from 'app/components/table/use-table';
import type { NotificationFacts, Project } from 'app/models/project';
import { Constants } from 'app/utils/constants';
import { contentTabFor, isStandardSegment, STANDARD_SEGMENTS } from './extended/extended-page';
import type { ExtendedPage, StandardSegment } from './extended/types';
import type { ProjectContext } from './project-context';
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

/** Every document filed under the id; an empty id asks nothing. */
export function useProjectDocumentCount(projId: string): { total: number; pending: boolean } {
  const documents = useTable('projectTabDocuments', {
    ...COUNT_QUERY,
    dataset: 'Document',
    enabled: !!projId,
    queryModifiers: { project: projId },
  });
  return {
    total: documents.totalListItems,
    pending: !documents.totalListItems && documents.loading,
  };
}

/** The Documents tab, counting every document filed under the id. */
function useDocumentsTab(projId: string): ProjectTab {
  const { total, pending } = useProjectDocumentCount(projId);
  return {
    key: 'documents',
    label: 'Documents',
    count: total ? total.toLocaleString('en-CA') : undefined,
    countPending: pending,
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

/**
 * Every standard tab with its label, count and show rule. Only the `wanted` tabs ask for their
 * counts; the rest pass an empty id, which asks nothing.
 */
function useStandardTabs(
  projId: string,
  lists: ProjectContext['lists'],
  project: Project | null,
  wanted: ReadonlySet<string>,
): Record<StandardSegment, ProjectTab> {
  const ask = (segment: StandardSegment) => (wanted.has(segment) ? projId : '');
  const probes = useDocTabProbes(
    wanted.has('decisions') || wanted.has('compliance') ? projId : '',
    lists,
  );

  // The visible list, not a raw count: a draft row must not open the tab.
  const { data: updates, isPending: updatesPending } = useQuery(
    projectUpdatesQueryOptions(ask('updates')),
  );

  const engagement = useEngagementTab(ask('engagement'));
  const documents = useDocumentsTab(ask('documents'));

  const decision = project?.eacDecision?.name;

  return {
    overview: OVERVIEW_TAB,
    updates: {
      key: 'updates',
      label: 'Updates',
      count: updates?.length ? String(updates.length) : undefined,
      countPending: updatesPending,
      // Held in the strip while the list loads, so it does not pop in after its neighbours.
      show: updatesPending || !!updates?.length,
    },
    engagement,
    documents,
    decisions: {
      key: 'decisions',
      label: 'Decisions',
      show:
        (!!decision && decision !== UNDECIDED) ||
        probes.has[Constants.optionalProjectDocTabs.CERTIFICATE] === true,
    },
    compliance: {
      key: 'compliance',
      label: 'Compliance',
      show: probes.has[Constants.optionalProjectDocTabs.COMPLIANCE] === true,
    },
  };
}

const ALL_STANDARD: ReadonlySet<string> = new Set(STANDARD_SEGMENTS);

/**
 * An extended project page's strip: its `tabs` in order, or the standard strip when it has none. A
 * standard entry keeps its own label, count and show rule; a content tab takes its label from the
 * entry, and `count: 'updates'` counts the page's updates and hides the tab when there are none.
 */
export function useExtendedTabMeta(
  projId: string,
  extended: ExtendedPage,
  lists: ProjectContext['lists'],
  project: Project | null,
): ProjectTab[] {
  const entries = extended.tabs;
  const wanted = entries
    ? new Set(
        entries
          .filter((entry) => !contentTabFor(extended, entry.segment))
          .map((entry) => entry.segment),
      )
    : ALL_STANDARD;
  const standard = useStandardTabs(projId, lists, project, wanted);
  if (!entries) return STANDARD_SEGMENTS.map((segment) => standard[segment]);

  const updates = extended.updates?.length ?? 0;
  return entries.flatMap((entry): ProjectTab[] => {
    const own = isStandardSegment(entry.segment) ? standard[entry.segment] : undefined;
    const content = contentTabFor(extended, entry.segment);
    if (!content) return own ? [own] : [];
    const tab = {
      key: content.segment,
      label: content.label ?? content.title ?? own?.label ?? content.segment,
    };
    if (content.count === 'updates') {
      return [{ ...tab, count: updates ? String(updates) : undefined, show: updates > 0 }];
    }
    return [{ ...tab, show: true }];
  });
}

/** The tab strip's labels, counts and visibility rules. */
export function useProjectTabMeta(
  projId: string,
  lists: any[],
  project: Project | null,
): ProjectTab[] {
  const standard = useStandardTabs(projId, lists, project, ALL_STANDARD);
  return STANDARD_SEGMENTS.map((segment) => standard[segment]);
}
