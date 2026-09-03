import * as api from './api';
import { Document } from 'app/models/document';

export async function getByMultiId(ids: string[]): Promise<Document[]> {
  const res = await api.getDocumentsByMultiId(ids);
  return res ? res.map((doc: any) => new Document(doc)) : [];
}

export async function add(formData: FormData): Promise<Document | null> {
  const res = await api.uploadDocument(formData);
  return res ? new Document(res) : null;
}
