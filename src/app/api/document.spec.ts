import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as api from './api';
import * as documentApi from './document';
import { Document } from 'app/models/document';

vi.mock('./api');

describe('document', () => {
  beforeEach(() => vi.resetAllMocks());

  it('wraps every result of a multi-id lookup in a Document', async () => {
    vi.mocked(api.getDocumentsByMultiId).mockResolvedValue([{ _id: 'a' }, { _id: 'b' }] as any);

    const documents = await documentApi.getByMultiId(['a', 'b']);

    expect(documents).toHaveLength(2);
    expect(documents[0]).toBeInstanceOf(Document);
  });
});
