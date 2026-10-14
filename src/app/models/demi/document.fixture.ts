import type { NativeDocument } from 'app/api/document';

/** A test document in the shape the pages read: `_id`, and List ids under the legacy names. */
export interface PageDocument {
  _id: string;
  type?: string;
  milestone?: string;
  projectPhase?: string;
  documentAuthorType?: string;
  internalSize?: string;
  [field: string]: unknown;
}

/** The row DEMI's native `/documents` answers for `doc`: `id`, List ids under `…Id`, and the byte count. */
export function nativeDocument({
  _id,
  type,
  milestone,
  projectPhase,
  documentAuthorType,
  internalSize,
  ...fields
}: PageDocument): NativeDocument {
  return {
    ...fields,
    id: _id,
    typeId: type,
    milestoneId: milestone,
    projectPhaseId: projectPhase,
    documentAuthorTypeId: documentAuthorType,
    fileSize: internalSize === undefined ? undefined : Number(internalSize),
  };
}
