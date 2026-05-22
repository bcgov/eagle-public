import { DateTime } from 'luxon';
import { Project } from './project';
import { assignFromObj } from 'app/shared/utils/model-utils';


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
  commentTip!: string;
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
  milestone!: string;
  openCommentPeriod!: string;
  openHouses!: { eventDate: string; description: string }[] | any;
  periodType!: string;
  phase!: string;
  phaseName!: string;
  project!: Project;
  publishedPercent!: number;
  rangeOption!: string;
  rangeType!: string;
  relatedDocuments: string[] = [];
  resolvedPercent!: number;
  updatedBy!: string;
  userCan!: string;
  vettedPercent!: number;
  vettingRoles!: string;
  daysRemainingCount!: number;

  longEndDate!: DateTime;
  endDateDisplay!: string;
  // Permissions
  read: string[] = [];
  write: string[] = [];
  delete: string[] = [];

  // Not from API
  commentPeriodStatus!: string;
  daysRemaining!: string;

  constructor(obj?: any) {
    assignFromObj(this, obj, [
      '_id', '__v', '_schemaName', 'addedBy', 'additionalText', 'ceaaAdditionalText',
      'ceaaInformationLabel', 'ceaaRelatedDocuments', 'classificationRoles', 'classifiedPercent',
      'commenterRoles', 'commentTip', 'dateAdded', 'dateCompletedEst', 'dateStartedEst',
      'dateUpdated', 'downloadRoles', 'informationLabel', 'instructions', 'isMet', 'isClassified',
      'isPublished', 'isResolved', 'isVetted', 'metURL', 'milestone', 'openHouses', 'periodType',
      'phase', 'phaseName', 'project', 'publishedPercent', 'rangeOption', 'rangeType',
      'relatedDocuments', 'resolvedPercent', 'updatedBy', 'userCan', 'vettedPercent',
      'vettingRoles', 'read', 'write', 'delete',
    ]);

    this.daysRemainingCount = 0;

    if (obj && obj.dateStarted) {
      this.dateStarted = new Date(obj.dateStarted);
    }

    if (obj && obj.dateCompleted) {
      this.dateCompleted = new Date(obj.dateCompleted);
    }

    // get comment period days remaining and determine commentPeriodStatus of the period
    if (obj && obj.dateStarted && obj.dateCompleted) {
      const now = DateTime.now();
      const dateStarted = DateTime.fromJSDate(new Date(obj.dateStarted));
      // When dateCompleted is midnight (admin picked a date with no time), treat the period
      // as closing at end of that day (11:59:59 PM) to satisfy "open until 11:59 PM" requirement.
      const rawEnd = DateTime.fromJSDate(new Date(obj.dateCompleted));
      const dateCompleted = (rawEnd.hour === 0 && rawEnd.minute === 0 && rawEnd.second === 0)
        ? rawEnd.endOf('day')
        : rawEnd;

      if (now < dateStarted) {
        this.commentPeriodStatus = 'Pending';
        this.daysRemaining = 'Pending';
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

    this.longEndDate = DateTime.fromJSDate(this.dateCompleted).setZone('local');

    // Build a display string that avoids misleading "12:00 AM" times.
    // Midnight (00:00) = admin picked that date as closing day (start-of-day stored) — show date-only.
    // 23:59 means "end of that day" — show date-only.
    // Any other time — show full datetime.
    const h = this.longEndDate.hour;
    const m = this.longEndDate.minute;
    if ((h === 0 && m === 0) || (h === 23 && m === 59)) {
      this.endDateDisplay = this.longEndDate.toFormat('MMMM dd, yyyy');
    } else {
      this.endDateDisplay = this.longEndDate.toFormat('MMMM dd @ h:mm a ZZZZ');
    }
  }
}
