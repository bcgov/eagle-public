import { DateTime } from 'luxon';
import { isSafeUrl } from 'app/utils/safe-url';
import { Project } from './project';

// Deadlines are BC-based, so every date is read and displayed in Pacific time.
const PACIFIC = 'America/Vancouver';

/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
export class CommentPeriod {
  _id!: string;
  __v!: number;
  _schemaName!: string;
  addedBy!: string;
  additionalText!: string;
  ceaaAdditionalText!: string;
  ceaaInformationLabel!: string;
  ceaaRelatedDocuments!: string;
  classificationRoles!: string;
  classifiedPercent!: number;
  commenterRoles!: string;
  dateAdded!: string;
  dateCompleted!: Date;
  dateCompletedEst!: string;
  dateStarted!: Date;
  dateStartedEst!: string;
  dateUpdated!: string;
  downloadRoles!: string;
  informationLabel!: string;
  instructions!: string;
  isClassified!: boolean;
  isMet!: boolean;
  isPublished!: boolean;
  isResolved!: boolean;
  isVetted!: string;
  metURL!: string;
  metBannerImageUrl!: string;
  milestone!: string;
  openCommentPeriod!: string;
  openHouses!: { eventDate: string; description: string }[] | any;
  periodType!: string;
  phase!: string;
  phaseName!: string;
  project!: Project;
  /** Set on every search row; absent when the project is hidden or the parent is a notification. */
  projectName?: string;
  publishedPercent!: number;
  rangeOption!: string;
  rangeType!: string;
  relatedDocuments: string[] = [];
  resolvedPercent!: number;
  updatedBy!: string;
  userCan!: string;
  vettedPercent!: number;
  vettingRoles!: string;
  daysRemainingCount = 0;

  longEndDate: DateTime;
  // Permissions
  read: string[] = [];
  write: string[] = [];
  delete: string[] = [];

  // Not from API
  commentPeriodStatus!: string;
  daysRemaining!: string;
  endDateDisplay!: string;

  constructor(obj?: any) {
    Object.assign(this, obj);

    this.daysRemainingCount = 0;

    if (obj && obj.dateStarted) {
      this.dateStarted = new Date(obj.dateStarted);
    }

    if (obj && obj.dateCompleted) {
      this.dateCompleted = new Date(obj.dateCompleted);
    }

    // get comment period days remaining and determine commentPeriodStatus of the period
    if (obj && obj.dateStarted && obj.dateCompleted) {
      const now = DateTime.now().setZone(PACIFIC);
      const dateStarted = DateTime.fromJSDate(this.dateStarted).setZone(PACIFIC);
      const dateCompleted = this.closesAt;

      if (now < dateStarted) {
        this.commentPeriodStatus = 'Upcoming';
        this.daysRemaining = 'Upcoming';
      } else if (now >= dateStarted && now <= dateCompleted) {
        this.commentPeriodStatus = 'Open';
        this.daysRemainingCount = Math.floor(dateCompleted.diff(now, 'days').days);
        this.daysRemaining =
          this.daysRemainingCount === 0
            ? 'Final Day'
            : this.daysRemainingCount +
              (this.daysRemainingCount === 1 ? ' Day ' : ' Days ') +
              'Remaining';
      } else if (now > dateCompleted) {
        this.commentPeriodStatus = 'Closed';
        this.daysRemaining = 'Completed';
      } else {
        this.commentPeriodStatus = 'None';
        this.daysRemaining = 'None';
      }
    }

    this.longEndDate = DateTime.fromJSDate(this.dateCompleted).setZone(PACIFIC);

    // Build a display string that avoids misleading "12:00 AM" times.
    // Midnight (00:00) = admin picked that date as closing day (start-of-day stored) — show date-only.
    // 23:59 means "end of that day" — show date-only.
    // Any other time — show full datetime in Pacific.
    const h = this.longEndDate.hour;
    const m = this.longEndDate.minute;
    if ((h === 0 && m === 0) || (h === 23 && m === 59)) {
      this.endDateDisplay = this.longEndDate.toFormat('MMMM dd, yyyy');
    } else {
      this.endDateDisplay = this.longEndDate.toFormat('MMMM dd @ h:mm a ZZZZ');
    }
  }

  /**
   * When dateCompleted is midnight (admin picked a date with no time), the period closes at the
   * end of that day (11:59:59 PM Pacific) to satisfy the "open until 11:59 PM" requirement.
   */
  private get closesAt(): DateTime {
    const end = DateTime.fromJSDate(this.dateCompleted).setZone(PACIFIC);
    return end.hour === 0 && end.minute === 0 && end.second === 0 ? end.endOf('day') : end;
  }

  public get isBannerVisible(): boolean {
    if (!this.dateStarted || !this.dateCompleted) return false;

    const now = DateTime.now().setZone(PACIFIC);
    const start = DateTime.fromJSDate(this.dateStarted).setZone(PACIFIC);
    const dateCompleted = this.closesAt;

    const isUpcoming = now >= start.minus({ days: 7 }) && now < start;
    const isOpen = now >= start && now <= dateCompleted;
    const isClosed = now > dateCompleted && now <= dateCompleted.plus({ days: 7 });

    return isUpcoming || isOpen || isClosed;
  }

  public get bannerState(): 'Upcoming' | 'Open' | 'Closed' | 'None' {
    if (!this.dateStarted || !this.dateCompleted) return 'None';

    const now = DateTime.now().setZone(PACIFIC);
    const start = DateTime.fromJSDate(this.dateStarted).setZone(PACIFIC);
    const dateCompleted = this.closesAt;

    if (now < start) return 'Upcoming';
    if (now >= start && now <= dateCompleted) return 'Open';
    return 'Closed';
  }

  public get bannerCTA(): string {
    return this.bannerState === 'Open' ? 'Share your thoughts' : 'View engagement';
  }

  public get bannerTimerPillText(): string {
    if (this.bannerState === 'Upcoming') {
      return `Starts ${pacificDay(this.dateStarted)}`;
    }
    if (this.bannerState === 'Open') {
      return this.daysRemaining;
    }
    return `Closed ${pacificDay(this.dateCompleted)}`;
  }
}

/** A period date as a BC reader dates it, e.g. `Mar 3, 2025`, whatever the browser's zone. */
function pacificDay(value: Date): string {
  return DateTime.fromJSDate(value).setZone(PACIFIC).toFormat('MMM d, yyyy');
}

/** The period's span, or the one end of it the row carries; blank when it has neither date. */
export function periodDates(period: CommentPeriod): string {
  const start = period.dateStarted ? pacificDay(period.dateStarted) : '';
  const end = period.dateCompleted ? pacificDay(period.dateCompleted) : '';
  if (start && end) return `${start} – ${end}`;
  if (start) return `Opens ${start}`;
  return end ? `Closes ${end}` : '';
}

/** The period's details page, or null when the row names no project to reach it through. */
export function periodDetailsHref(period: CommentPeriod): string | null {
  // A row carries its project as an Eagle id or as a populated project.
  const project = period.project as unknown;
  const projectId =
    typeof project === 'string' ? project : ((project as { _id?: string } | null)?._id ?? '');
  // The row does not say whether its parent is a notification, so such a period gets /p/, not /pn/.
  return projectId ? `/p/${projectId}/cp/${period._id}/details` : null;
}

/** The ENGAGE page of an ENGAGE-hosted period, or null when it is not hosted there or the URL is unsafe. */
export function engageUrl(period: {
  isMet?: boolean | null;
  metURL?: string | null;
}): string | null {
  return period.isMet && isSafeUrl(period.metURL) ? period.metURL : null;
}

/** What a list of periods across projects calls one: its project, else its own label. */
export function periodName(period: CommentPeriod): string {
  // `||`: the index sends an unset label as ''.
  return period.projectName || period.informationLabel || 'Comment period';
}

/** The period's own label, where it says more than the name the row already shows. */
export function periodLabel(period: CommentPeriod): string {
  const label = period.informationLabel?.trim() ?? '';
  return label && label !== periodName(period).trim() ? label : '';
}
