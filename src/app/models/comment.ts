export class Comment {
  _id: string;
  author: string;
  comment: string;
  commentId: number;
  dateAdded: Date;
  dateUpdated: Date;
  isAnonymous: boolean;
  location: string;
  period: any;
  submittedCAC: Boolean;
  documents: any;
  documentsList: any;

  // Permissions
  read: Array<String> = [];
  write: Array<String> = [];
  delete: Array<String> = [];

  constructor(obj?: any) {
    this._id            = obj && obj._id         || null;
    this.author         = obj && obj.author      || null;
    this.commentId      = obj && obj.commentId   || null;
    this.dateAdded      = obj && obj.dateAdded   || null;
    this.dateUpdated    = obj && obj.dateUpdated || null;
    this.delete         = obj && obj.delete      || null;
    this.isAnonymous    = obj && obj.isAnonymous || null;
    this.location       = obj && obj.location    || null;
    this.documents       = obj && obj.documents    || null;
    this.documentsList       = obj && obj.documentsList    || [];
    this.period         = obj && obj.period      || null;
    this.submittedCAC   = obj && obj.submittedCAC || null;
    this.read           = obj && obj.read        || null;
    this.write          = obj && obj.write       || null;

    if (obj && obj.dateAdded) {
      this.dateAdded = new Date(obj.dateAdded);
    }

    // replace \\n (JSON format) with newlines
    if (obj && obj.comment) {
      this.comment = obj.comment.replace(/\\n/g, '\n');
    }
  }
}
