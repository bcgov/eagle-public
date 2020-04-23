import { CommentPeriod } from './commentperiod';

export class ProjectNotification {
  _id: string;
  name: String;
  type: String;
  subType: String;
  nature: String;
  region: String;
  location: String;
  decision: String;
  decisionDate: Date;
  description: String;
  trigger: String;
  associatedProjectId: string;
  associatedProjectName: string;
  centroid: Array<number>;
  // dynamic attributes
  commentPeriod: CommentPeriod;
  documents: Array<Document>;

  read: Array<String> = [];

  constructor(obj?: any) {
    this._id = obj && obj._id || undefined;
    this.name = obj && obj.name || undefined;
    this.type = obj && obj.type || undefined;
    this.subType = obj && obj.subType || undefined;
    this.nature = obj && obj.nature || undefined;
    this.region = obj && obj.region || undefined;
    this.location = obj && obj.location || undefined;
    this.decision = obj && obj.decision || undefined;
    this.decisionDate = obj && obj.decisionDate || undefined;
    this.description = obj && obj.description || undefined;
    this.trigger = obj && obj.trigger || undefined;
    this.centroid = obj && obj.centroid || [];
    this.associatedProjectId = obj && obj.associatedProjectId || undefined;
    this.associatedProjectName = obj && obj.associatedProjectName || undefined;
    this.read = obj && obj.read || undefined;
  }
}
