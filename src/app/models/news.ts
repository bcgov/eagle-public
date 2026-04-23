import { Project } from './project';
import { ProjectNotification } from './projectNotification';
import { CommentPeriod } from './commentperiod';
import { assignFromObj } from 'app/shared/utils/model-utils';

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
    assignFromObj(this, obj, [
      '_id', 'headline', 'content', 'project', 'type', 'pcp', 'projectNotification',
      'active', 'dateAdded', 'dateUpdated', 'contentUrl', 'notificationName', 'documentUrl',
    ]);
  }
}
