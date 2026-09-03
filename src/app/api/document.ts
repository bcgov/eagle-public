import * as api from './api';
import { Document } from 'app/models/document';
import { startLoading, stopLoading } from 'app/state/loading-state';

export async function getByMultiId(ids: string[]): Promise<Document[]> {
  const loadingId = `documents-multi-${ids.length}`;
  startLoading(loadingId, `Loading ${ids.length} documents`);
  try {
    const res = await api.getDocumentsByMultiId(ids);
    return res ? res.map((doc: any) => new Document(doc)) : [];
  } finally {
    stopLoading(loadingId);
  }
}

export async function add(formData: FormData): Promise<Document | null> {
  startLoading('document-upload', 'Uploading document');
  try {
    const res = await api.uploadDocument(formData);
    return res ? new Document(res) : null;
  } finally {
    stopLoading('document-upload');
  }
}
