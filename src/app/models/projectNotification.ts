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
  // Comment period / Engage fields
  pcp!: string;
  isMet!: boolean;
  metURL!: string;
  dateStarted!: Date | null;
  dateCompleted!: Date | null;

  read: string[] = [];

  constructor(obj?: any) {
    assignFromObj(this, obj, [
      '_id', 'name', 'type', 'subType', 'region', 'location', 'decision', 'decisionDate',
      'description', 'trigger', 'associatedProjectId', 'associatedProjectName', 'proponent', 'read',
      'pcp', 'isMet', 'metURL', 'dateStarted', 'dateCompleted',
    ], undefined);
    this.centroid = obj?.centroid ?? [];
  }
}
