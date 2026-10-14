import { CommentPeriod } from 'app/models/commentperiod';
import { Project, type NotificationFacts } from 'app/models/project';
import { ProjectNotification } from 'app/models/projectNotification';
import { proponentName } from 'app/pages/search/types/projects';
import { ApiError, getNative } from './api';

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

/** One notification by id, `null` when DEMI holds none the caller may read. Its `id` is the Eagle id. */
export async function getNotificationById(id: string): Promise<Project | null> {
  try {
    const { id: eagleId, ...row } = await getNative<{ id: string }>('notifications', id);
    return notificationToProject(new ProjectNotification({ ...row, _id: eagleId }));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
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
