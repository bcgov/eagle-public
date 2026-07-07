import { CommentPeriod } from './commentperiod';

export class ProjectNotification {
  _id: string;
  name: string;
  type: string;
  subType: string;
  region: string;
  location: string;
  decision: string;
  decisionDate: Date;
  description: string;
  trigger: string;
  associatedProjectId: string;
  associatedProjectName: string;
  proponent: string;
  centroid: number[];
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
    this._id = obj && obj._id || undefined;
    this.name = obj && obj.name || undefined;
    this.type = obj && obj.type || undefined;
    this.subType = obj && obj.subType || undefined;
    this.region = obj && obj.region || undefined;
    this.location = obj && obj.location || undefined;
    this.decision = obj && obj.decision || undefined;
    this.decisionDate = obj && obj.decisionDate || undefined;
    this.description = obj && obj.description || undefined;
    this.trigger = obj && obj.trigger || undefined;
    this.centroid = obj && obj.centroid || [];
    this.associatedProjectId = obj && obj.associatedProjectId || undefined;
    this.associatedProjectName = obj && obj.associatedProjectName || undefined;
    this.proponent = obj && obj.proponent || undefined;
    this.pcp = obj && obj.pcp || undefined;
    this.isMet = obj && obj.isMet || undefined;
    this.metURL = obj && obj.metURL || undefined;
    this.dateStarted = obj && obj.dateStarted ? new Date(obj.dateStarted) : null;
    this.dateCompleted = obj && obj.dateCompleted ? new Date(obj.dateCompleted) : null;

    this.read = obj && obj.read || undefined;
  }
}
