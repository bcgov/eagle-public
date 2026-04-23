import { assignFromObj } from 'app/shared/utils/model-utils';

export class Document {
  _id!: string;
  project!: string;
  documentFileName?: string;
  documentFileSize?: number;
  internalOriginalName!: string;
  internalURL!: string;
  passedAVCheck!: boolean;
  internalMime!: string;
  internalSize!: string;
  documentSource!: string;
  displayName!: string;
  milestone!: string;
  dateUploaded!: string;
  type!: string;
  description!: string;
  documentAuthor!: string;
  documentAuthorType!: string;
  eaoStatus!: string;
  datePosted!: Date;
  dateUpdated!: Date;
  projectPhase!: string;

  checkbox!: boolean;
  upfile!: File;
  labels!: any[];
  isPublished = false; // depends on tags; see below
  isFeatured = false;

  constructor(obj?: any) {
    assignFromObj(this, obj, [
      '_id', 'project', 'documentFileName', 'internalOriginalName', 'internalURL',
      'passedAVCheck', 'internalMime', 'internalSize', 'documentSource', 'displayName',
      'milestone', 'dateUploaded', 'dateUpdated', 'datePosted', 'type', 'description',
      'documentAuthor', 'eaoStatus', 'projectPhase', 'checkbox', 'upfile', 'labels',
    ]);
    this.isFeatured = obj?.isFeatured ?? false;
  }
}
