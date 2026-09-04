import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { tableObject } from 'app/components/table/table-object';
import { clearSelection } from 'app/state/bulk-download';
import { DocumentGridRow } from './document-grid-row';

const LISTS = [
  { _id: 'ph-amend', name: 'Post Decision - Amendment', type: 'projectPhase' },
  { _id: 'ph-complete', name: 'Post Decision - Complete', type: 'projectPhase' },
  { _id: 'ph-other', name: 'Other', type: 'projectPhase' },
];

const DOCUMENT = {
  _id: 'doc-1',
  displayName: 'Fish Habitat Report',
  documentFileName: 'fish-habitat.pdf',
  datePosted: '2026-05-04T00:00:00.000Z',
  projectPhase: 'ph-amend',
  isFeatured: true,
};

function renderRow(rowData: any = DOCUMENT, showFeatured = true) {
  render(
    <MemoryRouter>
      <table>
        <tbody>
          <DocumentGridRow
            rowData={rowData}
            tableData={tableObject({
              tableId: 'documents',
              options: { selectable: true },
              data: { lists: LISTS, showFeatured },
            })}
            columns={[]}
            onMessage={() => undefined}
          />
        </tbody>
      </table>
    </MemoryRouter>,
  );
}

describe('DocumentGridRow', () => {
  beforeEach(() => clearSelection());

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

  it('marks a featured document', () => {
    renderRow();

    expect(screen.getByRole('img', { name: 'Featured' })).toBeInTheDocument();
  });

  it('leaves the star off a table that does not show featured documents', () => {
    renderRow(DOCUMENT, false);

    expect(screen.queryByRole('img', { name: 'Featured' })).not.toBeInTheDocument();
  });

  it('marks the row selected when its checkbox is ticked', async () => {
    renderRow();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Fish Habitat Report' }));

    expect(screen.getByRole('row')).toHaveClass('data-table__row--selected');
  });
});
