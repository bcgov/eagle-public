import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { DisplayGrid } from 'app/components/display-grid/display-grid';
import { Constants } from 'app/utils/constants';
import { openDocumentDownload } from 'app/utils/utils';
import { documentColumns, type DocumentRow } from './document-columns';

vi.mock('app/utils/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/utils/utils')>()),
  openDocumentDownload: vi.fn(),
}));

const LISTS = [
  { _id: 'ph-amend', name: 'Post Decision - Amendment', type: 'projectPhase' },
  { _id: 'ph-complete', name: 'Post Decision - Complete', type: 'projectPhase' },
  { _id: 'ph-other', name: 'Other', type: 'projectPhase' },
  { _id: 'type-cert', name: 'Certificate Package', type: 'doctype' },
  { _id: 'ms-cert', name: 'Certificate', type: 'label' },
];

const DOCUMENT: DocumentRow = {
  _id: 'doc-1',
  displayName: 'Fish Habitat Report',
  documentFileName: 'fish-habitat.pdf',
  datePosted: '2026-05-04T00:00:00.000Z',
  type: 'type-cert',
  milestone: 'ms-cert',
  projectPhase: 'ph-amend',
  isFeatured: true,
};

function renderRow(row: DocumentRow = DOCUMENT, showFeatured = true) {
  render(
    <MemoryRouter>
      <DisplayGrid<DocumentRow>
        caption="Project documents"
        columns={documentColumns(LISTS, showFeatured)}
        rows={[row]}
        page={1}
        pageSize={10}
        total={1}
        rowId={(item) => item._id}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('project document columns', () => {
  it('lists the five columns the tab has always shown, in order', () => {
    renderRow();

    // The sort arrow rides in the same cell and is hidden from assistive tech; the name is not.
    const names = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.querySelector('.display-grid__sort-label')?.textContent);
    expect(names).toEqual(['Name', 'Date', 'Type', 'Milestone', 'Phase']);
  });

  it('resolves the coded cells to their list names', () => {
    renderRow();

    expect(screen.getByRole('cell', { name: 'Certificate Package' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Certificate' })).toBeInTheDocument();
  });

  it('writes the posted date out in full', () => {
    renderRow();

    expect(screen.getByRole('cell', { name: 'May 4, 2026' })).toBeInTheDocument();
  });

  it('leaves the date cell empty for a document carrying the no-date placeholder', () => {
    renderRow({ ...DOCUMENT, datePosted: Constants.NO_DATE });

    expect(screen.queryByText(/1900/)).not.toBeInTheDocument();
  });

  it('tints the phase pill with the stage colour of that phase', () => {
    renderRow();

    expect(screen.getByText('Post Decision - Amendment')).toHaveStyle({
      background: 'var(--eao-amendment-light)',
    });
  });

  it('tints a Post Decision phase with the decision colour', () => {
    renderRow({ ...DOCUMENT, projectPhase: 'ph-complete' });

    expect(screen.getByText('Post Decision - Complete')).toHaveStyle({
      background: 'var(--eao-decision-light)',
    });
  });

  it('leaves a phase the palette has no colour for as a plain pill', () => {
    renderRow({ ...DOCUMENT, projectPhase: 'ph-other' });

    const pill = screen.getByText('Other');
    expect(pill).toHaveClass('document-grid__phase--plain');
    expect(pill.getAttribute('style')).toBeNull();
  });

  it('shows no pill at all for a document the lists give no phase', () => {
    renderRow({ ...DOCUMENT, projectPhase: 'ph-missing' });

    expect(document.querySelector('.document-grid__phase')).toBeNull();
  });

  it('marks a featured document', () => {
    renderRow();

    expect(screen.getByRole('img', { name: 'Featured' })).toBeInTheDocument();
  });

  it('leaves the star off a tab that does not show featured documents', () => {
    renderRow(DOCUMENT, false);

    expect(screen.queryByRole('img', { name: 'Featured' })).not.toBeInTheDocument();
  });

  /** Middle-click and copy-link still have to fetch the file, so the href is a real download URL. */
  it('links the name at the document download, outside the link the star sits in the cell', () => {
    renderRow();

    const link = screen.getByRole('link', { name: 'Fish Habitat Report' });
    expect(link).toHaveAttribute('href', '/demi-search/documents/doc-1/download?redirect=1');
  });

  it('presigns the download on click instead of following the href', async () => {
    renderRow();

    await userEvent.click(screen.getByRole('link', { name: 'Fish Habitat Report' }));

    expect(openDocumentDownload).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'doc-1', displayName: 'Fish Habitat Report' }),
    );
  });
});
