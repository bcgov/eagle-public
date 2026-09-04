import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { openDocumentDownload } from 'app/utils/utils';
import { DocumentLink } from './document-link';

vi.mock('app/utils/utils', () => ({
  documentDownloadUrl: (document: { _id: string }) => `/api/public/document/${document._id}`,
  openDocumentDownload: vi.fn(),
}));

const DOCUMENT = { _id: 'doc-1', displayName: 'Fish Habitat Report' };

describe('DocumentLink', () => {
  beforeEach(() => {
    vi.mocked(openDocumentDownload).mockClear();
    render(<DocumentLink document={DOCUMENT}>{DOCUMENT.displayName}</DocumentLink>);
  });

  it('renders the download URL as a real href, so copy-link and middle-click still work', () => {
    expect(screen.getByRole('link', { name: 'Fish Habitat Report' })).toHaveAttribute(
      'href',
      '/api/public/document/doc-1',
    );
  });

  it('downloads on click instead of navigating', () => {
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.click(screen.getByRole('link'))).toBe(false);
    expect(openDocumentDownload).toHaveBeenCalledWith(DOCUMENT);
  });
});
