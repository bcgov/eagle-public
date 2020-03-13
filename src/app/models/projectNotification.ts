import { CommentPeriod } from "./commentperiod";

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
  centroid: Array<number>;
  commentPeriod: CommentPeriod;

  read: Array<String> = [];

 /**
 * Maps a project notification API response to the data model.
 *
 * @param responseData Project Notification API response.
 * @returns {ProjectNotification} Complete project notification object.
 */
  public static mapResponseToModel(responseData: any): ProjectNotification {
    const projectNotification = {
      ...responseData
    };

    return projectNotification;
  }

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

    this.read = obj && obj.read || undefined;
  }
}
