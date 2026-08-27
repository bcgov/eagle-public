import * as api from './api';
import { Document } from 'app/models/document';
import { startLoading, stopLoading } from 'app/state/loading-state';

let cachedDocument: Document | null = null;

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

export async function getAllByDecisionId(decisionId: string): Promise<Document[]> {
  const loadingId = `documents-decision-${decisionId}`;
  startLoading(loadingId, 'Loading decision documents');
  try {
    const res = await api.getDocumentsByDecisionId(decisionId);
    return res ? res.map((document: any) => new Document(document)) : [];
  } finally {
    stopLoading(loadingId);
  }
}

export async function getAllByCommentId(commentId: string): Promise<Document[]> {
  const loadingId = `documents-comment-${commentId}`;
  startLoading(loadingId, 'Loading comment documents');
  try {
    const res = await api.getDocumentsByCommentId(commentId);
    return res ? res.map((document: any) => new Document(document)) : [];
  } finally {
    stopLoading(loadingId);
  }
}

export async function getById(documentId: string, forceReload = false): Promise<Document> {
  if (cachedDocument && cachedDocument._id === documentId && !forceReload) {
    return cachedDocument;
  }

  const loadingId = `document-${documentId}`;
  startLoading(loadingId, 'Loading document');
  try {
    const res = await api.getDocument(documentId);
    // return the first (only) document
    const document = res && res.length > 0 ? new Document(res[0]) : null;
    if (!document) {
      return null as unknown as Document;
    }
    cachedDocument = document;
    return cachedDocument;
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
