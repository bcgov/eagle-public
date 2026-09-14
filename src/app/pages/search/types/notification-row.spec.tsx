import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../../../test-utils';
import { NotificationRow } from './notification-row';

/** A notification with an open comment period, so all three tabs are on screen. */
const ROW = {
  _id: 'pn-1',
  name: 'Sinclair Mills Quarry',
  pcp: 'open',
  type: 'Mines',
  region: 'Cariboo',
};

function renderRow(rows = [ROW]) {
  return renderAt('/', [
    {
      path: '/',
      element: (
        <>
          {rows.map((row) => (
            <NotificationRow key={String(row._id)} row={row} />
          ))}
        </>
      ),
    },
  ]);
}

function tab(name: string): HTMLElement {
  return screen.getByRole('tab', { name });
}

describe('NotificationRow tabs', () => {
  it('points each tab at the panel it opens, and that panel back at the tab', () => {
    renderRow();

    const documents = tab('Documents');
    const panel = document.getElementById(String(documents.getAttribute('aria-controls')));

    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', documents.id);
  });

  it('gives two notifications on one page their own tab ids', () => {
    renderRow([ROW, { ...ROW, _id: 'pn-2', name: 'Bear Creek Pit' }]);

    const [first, second] = screen.getAllByRole('tab', { name: 'Documents' });

    expect(first.id).not.toBe(second.id);
    expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'));
  });

  it('keeps only the selected tab in the tab order', () => {
    renderRow();

    expect(tab('Details')).toHaveAttribute('tabindex', '0');
    expect(tab('Documents')).toHaveAttribute('tabindex', '-1');
    expect(tab('Engagement')).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to the next tab on ArrowRight', async () => {
    const user = userEvent.setup();
    renderRow();
    tab('Details').focus();

    await user.keyboard('{ArrowRight}');

    expect(tab('Documents')).toHaveFocus();
  });

  it('wraps from the last tab to the first on ArrowRight', async () => {
    const user = userEvent.setup();
    renderRow();
    tab('Engagement').focus();

    await user.keyboard('{ArrowRight}');

    expect(tab('Details')).toHaveFocus();
  });

  it('wraps from the first tab to the last on ArrowLeft', async () => {
    const user = userEvent.setup();
    renderRow();
    tab('Details').focus();

    await user.keyboard('{ArrowLeft}');

    expect(tab('Engagement')).toHaveFocus();
  });

  it('jumps to the first tab on Home', async () => {
    const user = userEvent.setup();
    renderRow();
    tab('Engagement').focus();

    await user.keyboard('{Home}');

    expect(tab('Details')).toHaveFocus();
  });

  it('jumps to the last tab on End', async () => {
    const user = userEvent.setup();
    renderRow();
    tab('Details').focus();

    await user.keyboard('{End}');

    expect(tab('Engagement')).toHaveFocus();
  });

  it('leaves the arrows to the tab list and does not select on focus alone', async () => {
    const user = userEvent.setup();
    renderRow();
    tab('Details').focus();

    await user.keyboard('{ArrowRight}');

    expect(tab('Documents')).toHaveAttribute('aria-selected', 'false');
    expect(tab('Details')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('NotificationRow details tab', () => {
  it('titles the notification at the same heading level as the other result cards', () => {
    renderRow();

    expect(
      screen.getByRole('heading', { level: 3, name: 'SINCLAIR MILLS QUARRY' }),
    ).toBeInTheDocument();
  });
});
