/**
 * One project's newest public documents, as the recent-uploads feed reports them.
 * Fields are copied straight off the API payload.
 */
export interface RecentUpload {
  /** DEMI's own project id, which is the Track project id. */
  projectId: string;
  /** The Eagle Mongo `_id`, the id project links route on. Null for a project Eagle has no row for. */
  eagleProjectId: string | null;
  projectName: string;
  /** When the newest of the documents below landed. */
  dateUploaded: string;
  /** Up to five of the project's newest public documents, newest first. */
  documents: RecentUploadDocument[];
}

/** `type` is a bare `List` id, the way DEMI stores it. */
export interface RecentUploadDocument {
  id: string;
  eagleId: string;
  displayName: string;
  documentFileName: string | null;
  type: string;
  dateUploaded: string;
}

export interface RecentUploads {
  items: RecentUpload[];
}
