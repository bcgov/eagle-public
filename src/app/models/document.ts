/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
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
    Object.assign(this, obj);
  }
}
