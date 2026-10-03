import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { openDocumentDownload } from 'app/utils/utils';
import { DocumentLink } from './document-link';

vi.mock('app/utils/utils', () => ({
  documentDownloadUrl: (document: { _id: string }) =>
    `/demi-search/documents/${document._id}/download?redirect=1`,
  openDocumentDownload: vi.fn(),
}));

const DOCUMENT = { _id: 'doc-1', displayName: 'Fish Habitat Report' };

describe('DocumentLink', () => {
  beforeEach(() => {
    vi.mocked(openDocumentDownload).mockClear();
    render(<DocumentLink document={DOCUMENT}>{DOCUMENT.displayName}</DocumentLink>);
  });

  it('tells the caller about the click before downloading', () => {
    const onClick = vi.fn();
    render(
      <DocumentLink document={DOCUMENT} onClick={onClick}>
        Reported copy
      </DocumentLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Reported copy' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(vi.mocked(openDocumentDownload).mock.invocationCallOrder[0]).toBeGreaterThan(
      onClick.mock.invocationCallOrder[0]!,
    );
  });

  it('renders the download URL as a real href, so copy-link and middle-click still work', () => {
    expect(screen.getByRole('link', { name: 'Fish Habitat Report' })).toHaveAttribute(
      'href',
      '/demi-search/documents/doc-1/download?redirect=1',
    );
  });

  it('downloads on click instead of navigating', () => {
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.click(screen.getByRole('link'))).toBe(false);
    expect(openDocumentDownload).toHaveBeenCalledWith(DOCUMENT);
  });
});
