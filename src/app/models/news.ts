import { Project } from './project';
import { ProjectNotification } from './projectNotification';
import { CommentPeriod } from './commentperiod';

/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
export class News {
  _id!: number;
  headline!: string;
  content!: string;
  active!: boolean;
  project!: Project;
  type!: string;
  pcp!: CommentPeriod | null;
  projectNotification!: ProjectNotification;
  dateAdded!: string;
  dateUpdated!: string;
  contentUrl!: string;
  documentUrl!: string;
  notificationName!: string;

  constructor(obj?: any) {
    Object.assign(this, obj);
  }
}
