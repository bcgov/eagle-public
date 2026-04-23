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
      const dateCompleted = DateTime.fromJSDate(new Date(obj.dateCompleted));

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
  }
}
