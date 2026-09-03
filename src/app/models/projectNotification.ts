import { CommentPeriod } from './commentperiod';

/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
export class ProjectNotification {
  _id!: string;
  name!: string;
  type!: string;
  subType!: string;
  region!: string;
  location!: string;
  decision!: string;
  decisionDate!: Date;
  description!: string;
  trigger!: string;
  associatedProjectId!: string;
  associatedProjectName!: string;
  proponent!: string;
  centroid: number[] = [];
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
