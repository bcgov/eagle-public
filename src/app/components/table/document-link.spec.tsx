import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { track } from 'app/analytics/analytics';
import { openDocumentDownload } from 'app/utils/utils';
import { DocumentLink } from './document-link';

vi.mock('app/analytics/analytics', () => ({ track: vi.fn() }));
vi.mock('app/utils/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/utils/utils')>()),
  openDocumentDownload: vi.fn(),
}));

const DOCUMENT = {
  _id: 'doc-1',
  displayName: 'Fish Habitat Report',
  documentFileName: 'fish.docx',
};
const PDF = {
  _id: 'doc-2',
  displayName: 'Fish Habitat Summary',
  documentFileName: 'summary.pdf',
  internalMime: 'application/pdf',
};

describe('DocumentLink', () => {
  beforeEach(() => {
    vi.mocked(openDocumentDownload).mockClear();
    vi.mocked(track).mockClear();
  });

  describe('for a file the browser cannot show', () => {
    beforeEach(() => {
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

  describe('for a PDF', () => {
    it('links at the inline view in a new tab', () => {
      render(<DocumentLink document={PDF}>{PDF.displayName}</DocumentLink>);

      const link = screen.getByRole('link', { name: 'Fish Habitat Summary' });
      expect(link).toHaveAttribute('href', '/demi-search/documents/doc-2/download?inline=1');
      expect(link).toHaveAttribute('target', '_blank');
    });

    // The browser opens the tab itself, so no popup blocker steps in.
    it('lets the browser follow the link, and still reports the click', () => {
      const onClick = vi.fn();
      render(
        <DocumentLink document={PDF} onClick={onClick}>
          {PDF.displayName}
        </DocumentLink>,
      );

      expect(fireEvent.click(screen.getByRole('link'))).toBe(true);
      expect(onClick).toHaveBeenCalledOnce();
      expect(openDocumentDownload).not.toHaveBeenCalled();
      expect(track).toHaveBeenCalledWith(
        'Document Downloaded',
        expect.objectContaining({ document_id: 'doc-2', document_name: 'summary.pdf' }),
      );
    });
  });
});
