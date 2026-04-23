import { CommentPeriod } from './commentperiod';
import { assignFromObj } from 'app/shared/utils/model-utils';

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
  centroid!: number[];
  // dynamic attributes
  commentPeriod!: CommentPeriod;
  documents!: Document[];

  read: string[] = [];

  constructor(obj?: any) {
    assignFromObj(this, obj, [
      '_id', 'name', 'type', 'subType', 'region', 'location', 'decision', 'decisionDate',
      'description', 'trigger', 'associatedProjectId', 'associatedProjectName', 'proponent', 'read',
    ], undefined);
    this.centroid = obj?.centroid ?? [];
  }
}
