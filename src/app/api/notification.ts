import { CommentPeriod } from 'app/models/commentperiod';
import { Project, type NotificationFacts } from 'app/models/project';
import { ProjectNotification } from 'app/models/projectNotification';
import { proponentName } from 'app/pages/search/types/projects';
import { rowsFrom, searchKeywords } from './api';

/** A notification read through the project page shell, which renders `Project` records. */
export function notificationToProject(n: ProjectNotification): Project {
  const facts: NotificationFacts = {
    trigger: n.trigger,
    notificationReceivedDate: n.notificationReceivedDate ?? undefined,
    notificationThresholdValue: n.notificationThresholdValue ?? undefined,
    notificationThresholdUnits: n.notificationThresholdUnits ?? undefined,
    associatedProjectId: n.associatedProjectId || undefined,
    pcp: n.pcp,
    isMet: n.isMet,
    metURL: n.metURL,
    dateStarted: n.dateStarted,
    dateCompleted: n.dateCompleted,
  };
  const centroid = n.centroid?.length === 2 ? [n.centroid[1], n.centroid[0]] : [];
  return new Project({
    _id: n._id,
    name: n.name,
    description: n.description,
    // A populated proponent arrives as an organization object, not a string.
    proponent: { name: proponentName({ proponent: n.proponent }) },
    region: n.region,
    location: n.location,
    type: n.type,
    sector: n.subType,
    nature: n.nature,
    centroid,
    eacDecision: n.decision ? { name: n.decision } : undefined,
    decisionDate: n.decisionDate ?? undefined,
    currentPhaseName: { name: 'Project Notification' },
    commentPeriodForBanner: null,
    notification: facts,
  });
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** One notification by `_id`, `null` when the dataset holds none. demi-search reads `and[_id]`. */
export async function getNotificationById(id: string): Promise<Project | null> {
  // The id rides the keyword query unencoded, where a comma would split it into two terms.
  if (!OBJECT_ID.test(id)) return null;
  const envelope = await searchKeywords('', 'ProjectNotification', [], 1, 1, '', null, {
    _id: id,
  });
  const row = rowsFrom<Record<string, unknown>>(envelope)[0];
  return row && row['_id'] === id ? notificationToProject(new ProjectNotification(row)) : null;
}

export function notificationQueryOptions(id: string) {
  return {
    queryKey: ['notification', id],
    enabled: !!id,
    queryFn: () => getNotificationById(id),
  };
}

function pcpStatus(pcp: string | undefined): string {
  if (!pcp || pcp === 'none') return '';
  if (pcp === 'pending') return 'Upcoming';
  return pcp.charAt(0).toUpperCase() + pcp.slice(1);
}

/**
 * The comment period a notification holds only as its own `pcp`/`isMet`/date fields, or `null`
 * when it has none.
 */
export function inlineCommentPeriod(id: string, facts: NotificationFacts): CommentPeriod | null {
  const status = pcpStatus(facts.pcp);
  if (!status) return null;
  const period = new CommentPeriod({
    // Same id as the notification: the engagement tab reads that match as "no page of its own".
    _id: id,
    project: id,
    isMet: facts.isMet,
    metURL: facts.metURL,
    dateStarted: facts.dateStarted,
    dateCompleted: facts.dateCompleted,
    instructions: 'Public Comment Period',
    additionalText: '',
  });
  period.commentPeriodStatus = status;
  if (
    status === 'Open' &&
    (!period.daysRemaining ||
      period.daysRemaining === 'Completed' ||
      period.daysRemaining === 'None')
  ) {
    period.daysRemaining = 'Active';
  }
  return period;
}
