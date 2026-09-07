import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../test-utils';
import { ActivityCard } from './activity-card';

/** The card renders a `<tr>`, so it needs a table around it and a router for its links. */
function renderCard(rowData: unknown) {
  return renderAt('/', [
    {
      path: '/',
      element: (
        <table>
          <tbody>
            <ActivityCard rowData={rowData} />
          </tbody>
        </table>
      ),
    },
    { path: '/p/:projId/cp/:commentPeriodId', element: <p>Engagement page</p> },
  ]);
}

function newsRow(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Public Comment Period',
    headline: 'Cedar Quarry comment period open',
    content: '<p>Have your say.</p>',
    dateAdded: '2026-08-01T00:00:00.000Z',
    project: { _id: 'proj1', name: 'Cedar Quarry' },
    pcp: { _id: 'cp1', isMet: false, metURL: '' },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ActivityCard', () => {
  it('opens the engagement for an update that carries a project', async () => {
    const user = userEvent.setup();
    renderCard(newsRow());

    await user.click(screen.getByRole('button', { name: 'View Engagement' }));

    expect(await screen.findByText('Engagement page')).toBeInTheDocument();
  });

  it('hides "View Engagement" when demi-search returns the period with no project', async () => {
    renderCard(newsRow({ project: null }));

    expect(screen.queryByRole('button', { name: 'View Engagement' })).not.toBeInTheDocument();
    // The rest of the card still renders; only the button that needs a project id is gone.
    expect(screen.getByText('Cedar Quarry comment period open')).toBeInTheDocument();
  });

  it('still opens a MET period with no project, because that link is external', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderCard(
      newsRow({
        project: null,
        pcp: { _id: 'cp1', isMet: true, metURL: 'https://met.example/cp1' },
      }),
    );

    await user.click(screen.getByRole('button', { name: 'View Engagement' }));

    expect(open).toHaveBeenCalledWith('https://met.example/cp1', '_blank', 'noopener,noreferrer');
  });
});
