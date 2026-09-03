/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
export class Comment {
  _id!: string;
  author!: string;
  comment!: string;
  commentId!: number;
  dateAdded!: Date;
  dateUpdated!: Date;
  isAnonymous!: boolean;
  location!: string;
  period: any;
  submittedCAC!: boolean;
  documents: any;
  documentsList: any = [];

  // Permissions
  read: string[] = [];
  write: string[] = [];
  delete: string[] = [];

  constructor(obj?: any) {
    Object.assign(this, obj);

    if (obj && obj.dateAdded) {
      this.dateAdded = new Date(obj.dateAdded);
    }

    // replace \\n (JSON format) with newlines
    if (obj && obj.comment) {
      this.comment = obj.comment.replace(/\\n/g, '\n');
    }
  }
}
