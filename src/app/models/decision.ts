import { Document } from './document';
import { assignFromObj } from 'app/shared/utils/model-utils';

export class Decision {
  _id!: string;
  _addedBy!: string; // objectid -> User
  _application!: string; // objectid -> Application
  name!: string;
  description?: string;

  // associated data
  documents: Document[] = [];

  constructor(obj?: any) {
    assignFromObj(this, obj, ['_id', '_addedBy', '_application', 'name']);

    // replace \\n (JSON format) with newlines
    if (obj && obj.description) {
      this.description = obj.description.replace(/\\n/g, '\n');
    }

    // copy documents
    if (obj && obj.documents) {
      for (const doc of obj.documents) {
        this.documents.push(doc);
      }
    }
  }
}
