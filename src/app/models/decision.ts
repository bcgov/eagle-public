import { Document } from './document';

export class Decision {
  _id: string;
  _addedBy: string; // objectid -> User
  _application: string; // objectid -> Application
  name: string;
  description?: string;

  // associated data
  documents: Document[] = [];

  constructor(obj?: any) {
    this._id = (obj && obj._id) || null;
    this._addedBy = (obj && obj._addedBy) || null;
    this._application = (obj && obj._application) || null;
    this.name = (obj && obj.name) || null;

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
