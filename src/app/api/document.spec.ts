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

  it('returns an empty list when the API returns nothing', async () => {
    vi.mocked(api.getDocumentsByDecisionId).mockResolvedValue(null as any);

    expect(await documentApi.getAllByDecisionId('1')).toEqual([]);
  });

  it('returns the first document for an id lookup', async () => {
    vi.mocked(api.getDocument).mockResolvedValue([{ _id: 'first' }, { _id: 'second' }] as any);

    expect((await documentApi.getById('first', true))._id).toEqual('first');
  });

  it('returns null when an id lookup finds nothing', async () => {
    vi.mocked(api.getDocument).mockResolvedValue([] as any);

    expect(await documentApi.getById('missing', true)).toBeNull();
  });
});
