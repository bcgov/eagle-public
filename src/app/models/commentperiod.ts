import { DateTime } from 'luxon';
import { Project } from './project';


export class CommentPeriod {
  _id: string;
  __v: number;
  _schemaName: string;
  addedBy: string;
  additionalText: string;
  ceaaAdditionalText: string;
  ceaaInformationLabel: string;
  ceaaRelatedDocuments: string;
  classificationRoles: string;
  classifiedPercent: number;
  commenterRoles: string;
  commentTip: string;
  dateAdded: string;
  dateCompleted!: Date;
  dateCompletedEst: string;
  dateStarted!: Date;
  dateStartedEst: string;
  dateUpdated: string;
  downloadRoles: string;
  informationLabel: string;
  instructions: string;
  isClassified: boolean;
  isMet: boolean;
  isPublished: boolean;
  isResolved: boolean;
  isVetted: string;
  metURL: string;
  metBannerImageUrl: string;
  milestone: string;
  openCommentPeriod!: string;
  openHouses: { eventDate: string; description: string }[] | any;
  periodType: string;
  phase: string;
  phaseName: string;
  project: Project;
  publishedPercent: number;
  rangeOption: string;
  rangeType: string;
  relatedDocuments: string[] = [];
  resolvedPercent: number;
  updatedBy: string;
  userCan: string;
  vettedPercent: number;
  vettingRoles: string;
  daysRemainingCount: number;

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
    this._id = obj && obj._id || null;
    this.__v = obj && obj.__v || null;
    this._schemaName = obj && obj._schemaName || null;
    this.addedBy = obj && obj.addedBy || null;
    this.additionalText = obj && obj.additionalText || null;
    this.ceaaAdditionalText = obj && obj.ceaaAdditionalText || null;
    this.ceaaInformationLabel = obj && obj.ceaaInformationLabel || null;
    this.ceaaRelatedDocuments = obj && obj.ceaaRelatedDocuments || null;
    this.classificationRoles = obj && obj.classificationRoles || null;
    this.classifiedPercent = obj && obj.classifiedPercent || null;
    this.commenterRoles = obj && obj.commenterRoles || null;
    this.commentTip = obj && obj.commentTip || null;
    this.dateAdded = obj && obj.dateAdded || null;
    this.dateCompletedEst = obj && obj.dateCompletedEst || null;
    this.dateStartedEst = obj && obj.dateStartedEst || null;
    this.dateUpdated = obj && obj.dateUpdated || null;
    this.downloadRoles = obj && obj.downloadRoles || null;
    this.informationLabel = obj && obj.informationLabel || null;
    this.instructions = obj && obj.instructions || null;
    this.isMet = obj && obj.isMet || null;
    this.isClassified = obj && obj.isClassified || null;
    this.isPublished = obj && obj.isPublished || null;
    this.isResolved = obj && obj.isResolved || null;
    this.isVetted = obj && obj.isVetted || null;
    this.metURL = obj && obj.metURL || null;
    this.metBannerImageUrl = obj && obj.metBannerImageUrl || null;
    this.milestone = obj && obj.milestone || null;
    this.openHouses = obj && obj.openHouses || null;
    this.periodType = obj && obj.periodType || null;
    this.phase = obj && obj.phase || null;
    this.phaseName = obj && obj.phaseName || null;
    this.project = obj && obj.project || null;
    this.publishedPercent = obj && obj.publishedPercent || null;
    this.rangeOption = obj && obj.rangeOption || null;
    this.rangeType = obj && obj.rangeType || null;
    this.relatedDocuments = obj && obj.relatedDocuments || null;
    this.resolvedPercent = obj && obj.resolvedPercent || null;
    this.updatedBy = obj && obj.updatedBy || null;
    this.userCan = obj && obj.userCan || null;
    this.vettedPercent = obj && obj.vettedPercent || null;
    this.vettingRoles = obj && obj.vettingRoles || null;

    this.read = obj && obj.read || null;
    this.write = obj && obj.write || null;
    this.delete = obj && obj.delete || null;

    this.daysRemainingCount = 0;

    if (obj && obj.dateStarted) {
      this.dateStarted = new Date(obj.dateStarted);
    }

    if (obj && obj.dateCompleted) {
      this.dateCompleted = new Date(obj.dateCompleted);
    }

    // get comment period days remaining and determine commentPeriodStatus of the period
    if (obj && obj.dateStarted && obj.dateCompleted) {
      const now = DateTime.now().setZone('America/Vancouver');
      const dateStarted = DateTime.fromJSDate(new Date(obj.dateStarted)).setZone('America/Vancouver');
      // When dateCompleted is midnight (admin picked a date with no time), treat the period
      // as closing at end of that day (11:59:59 PM Pacific) to satisfy "open until 11:59 PM" requirement.
      const rawEnd = DateTime.fromJSDate(new Date(obj.dateCompleted)).setZone('America/Vancouver');
      const dateCompleted = (rawEnd.hour === 0 && rawEnd.minute === 0 && rawEnd.second === 0)
        ? rawEnd.endOf('day')
        : rawEnd;

      if (now < dateStarted) {
        this.commentPeriodStatus = 'Upcoming';
        this.daysRemaining = 'Upcoming';
      } else if (now >= dateStarted && now <= dateCompleted) {
        this.commentPeriodStatus = 'Open';
        this.daysRemainingCount = Math.floor(dateCompleted.diff(now, 'days').days);
        this.daysRemaining = this.daysRemainingCount === 0 ? 'Final Day' : this.daysRemainingCount + (this.daysRemainingCount === 1 ? ' Day ' : ' Days ') + 'Remaining';
      } else if (now > dateCompleted) {
        this.commentPeriodStatus = 'Closed';
        this.daysRemaining = 'Completed';
      } else {
        this.commentPeriodStatus = 'None';
        this.daysRemaining = 'None';
      }
    }

    // Always display dates in Pacific time — BC-based engagement deadlines.
    this.longEndDate = DateTime.fromJSDate(this.dateCompleted).setZone('America/Vancouver');

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

  public get isBannerVisible(): boolean {
    if (!this.dateStarted || !this.dateCompleted) return false;
    
    const now = DateTime.now().setZone('America/Vancouver');
    const start = DateTime.fromJSDate(this.dateStarted).setZone('America/Vancouver');
    const end = DateTime.fromJSDate(this.dateCompleted).setZone('America/Vancouver');
    
    const dateCompleted = (end.hour === 0 && end.minute === 0 && end.second === 0)
      ? end.endOf('day')
      : end;

    const isUpcoming = now >= start.minus({ days: 7 }) && now < start;
    const isOpen = now >= start && now <= dateCompleted;
    const isClosed = now > dateCompleted && now <= dateCompleted.plus({ days: 7 });

    return isUpcoming || isOpen || isClosed;
  }

  public get bannerState(): 'Upcoming' | 'Open' | 'Closed' | 'None' {
    if (!this.dateStarted || !this.dateCompleted) return 'None';

    const now = DateTime.now().setZone('America/Vancouver');
    const start = DateTime.fromJSDate(this.dateStarted).setZone('America/Vancouver');
    const end = DateTime.fromJSDate(this.dateCompleted).setZone('America/Vancouver');
    const dateCompleted = (end.hour === 0 && end.minute === 0 && end.second === 0)
      ? end.endOf('day')
      : end;

    if (now < start) return 'Upcoming';
    if (now >= start && now <= dateCompleted) return 'Open';
    return 'Closed';
  }

  public get bannerCTA(): string {
    return this.bannerState === 'Open' ? 'Share your thoughts' : 'View engagement';
  }

  public get bannerTimerPillText(): string {
    const start = DateTime.fromJSDate(this.dateStarted).setZone('America/Vancouver');
    const end = DateTime.fromJSDate(this.dateCompleted).setZone('America/Vancouver');
    const dateCompleted = (end.hour === 0 && end.minute === 0 && end.second === 0)
      ? end.endOf('day')
      : end;

    if (this.bannerState === 'Upcoming') {
      return `Starts ${start.toFormat('MMM d, yyyy')}`;
    }
    if (this.bannerState === 'Open') {
      return this.daysRemaining;
    }
    return `Closed ${dateCompleted.toFormat('MMM d, yyyy')}`;
  }
}
