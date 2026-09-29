import { CommentPeriod } from './commentperiod';
import type { Document } from './document';

/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
export class ProjectNotification {
  _id!: string;
  name!: string;
  type!: string;
  subType!: string;
  nature!: string;
  region!: string;
  location!: string;
  decision!: string;
  decisionDate!: string | null;
  description!: string;
  trigger!: string;
  notificationReceivedDate!: string | null;
  notificationThresholdValue!: number | string | null;
  notificationThresholdUnits!: string | null;
  associatedProjectId!: string | null;
  associatedProjectName!: string | null;
  proponent!: string;
  /** Stored as `[lat, lon]`, the reverse of a project's centroid. */
  centroid: (number | string)[] = [];
  // dynamic attributes
  commentPeriod!: CommentPeriod;
  documents!: Document[];
  pcp!: string;
  isMet!: boolean;
  metURL!: string;
  dateStarted!: Date | null;
  dateCompleted!: Date | null;

  read: string[] = [];

  constructor(obj?: any) {
    Object.assign(this, obj);

    this.dateStarted = obj && obj.dateStarted ? new Date(obj.dateStarted) : null;
    this.dateCompleted = obj && obj.dateCompleted ? new Date(obj.dateCompleted) : null;
  }
}
