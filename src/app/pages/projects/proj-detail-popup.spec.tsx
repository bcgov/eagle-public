import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../../test-utils';
import { Project } from 'app/models/project';
import { CommentPeriod } from 'app/models/commentperiod';
import type { ProjectEngagement } from 'app/api/commentperiod';
import { ProjDetailPopup } from './proj-detail-popup';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('app/analytics/analytics', () => ({ track }));

const BASE = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  region: 'Cariboo',
  eacDecision: { name: 'Approved' },
  location: 'Near Quesnel',
};

// Noon UTC keeps the Pacific day the same; far enough out that the live clock never changes state.
const OPEN_ROW = {
  _id: 'cp1',
  project: 'proj-1',
  dateStarted: '2020-03-03T12:00:00Z',
  dateCompleted: '2099-06-01T12:00:00Z',
};
const UPCOMING_ROW = {
  _id: 'cp2',
  project: 'proj-1',
  dateStarted: '2098-01-10T12:00:00Z',
  dateCompleted: '2098-02-20T12:00:00Z',
};

function renderPopup(
  project: Project,
  engagement?: ProjectEngagement,
  variant: 'popup' | 'inline' = 'popup',
) {
  return renderAt('/', [
    {
      path: '/',
      element: <ProjDetailPopup project={project} engagement={engagement} variant={variant} />,
    },
    { path: '/p/:projId/cp/:periodId/details', element: <div>period details page</div> },
  ]);
}

function open(row: Record<string, unknown> = {}): ProjectEngagement {
  return { state: 'open', period: new CommentPeriod({ ...OPEN_ROW, ...row }) };
}

afterEach(() => vi.clearAllMocks());

describe('ProjDetailPopup EA Certificate', () => {
  it('shows the EA Certificate row when the project carries one', () => {
    renderPopup(new Project({ ...BASE, eaCertificate: 'E23-01' }));

    expect(screen.getByText('EA Certificate')).toBeInTheDocument();
    expect(screen.getByText('E23-01')).toBeInTheDocument();
  });

  it('hides the EA Certificate row when the field is absent, as on dev (eagle-api)', () => {
    renderPopup(new Project(BASE));

    expect(screen.queryByText('EA Certificate')).not.toBeInTheDocument();
  });

  it('hides the EA Certificate row when the field is an empty string', () => {
    renderPopup(new Project({ ...BASE, eaCertificate: '' }));

    expect(screen.queryByText('EA Certificate')).not.toBeInTheDocument();
  });
});

describe('ProjDetailPopup engagement banner', () => {
  it('draws no banner for a project with no open or upcoming period', () => {
    renderPopup(new Project(BASE));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('announces an open period hosted here with its dates and a link to its details page', () => {
    renderPopup(new Project(BASE), open());

    const banner = screen.getByRole('region', { name: 'Open for public comment' });
    expect(banner).toHaveTextContent('Mar 3, 2020 – Jun 1, 2099');
    expect(screen.getByRole('link', { name: 'View comment period' })).toHaveAttribute(
      'href',
      '/p/proj-1/cp/cp1/details',
    );
    expect(screen.queryByRole('link', { name: /Share your thoughts/ })).toBeNull();
  });

  it('announces an upcoming period with the overview wording on its link', () => {
    renderPopup(new Project(BASE), {
      state: 'upcoming',
      period: new CommentPeriod(UPCOMING_ROW),
    });

    const banner = screen.getByRole('region', { name: 'Public comment period coming soon' });
    expect(banner).toHaveTextContent('Jan 10, 2098 – Feb 20, 2098');
    expect(screen.getByRole('link', { name: 'View comment period' })).toHaveAttribute(
      'href',
      '/p/proj-1/cp/cp2/details',
    );
  });

  it('sends an ENGAGE-hosted period out to ENGAGE in a new tab', () => {
    renderPopup(
      new Project(BASE),
      open({ isMet: true, metURL: 'https://engage.eao.gov.bc.ca/cedar-quarry' }),
    );

    const link = screen.getByRole('link', { name: 'Share your thoughts (opens in new tab)' });
    expect(link).toHaveAttribute('href', 'https://engage.eao.gov.bc.ca/cedar-quarry');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('falls back to the in-app details page when the ENGAGE URL has an unsafe scheme', () => {
    renderPopup(new Project(BASE), open({ isMet: true, metURL: 'javascript:alert(1)' }));

    const link = screen.getByRole('link', { name: 'View comment period' });
    expect(link).toHaveAttribute('href', '/p/proj-1/cp/cp1/details');
    expect(link).not.toHaveAttribute('target');
  });

  it('tracks a banner click from the map card and opens the period', async () => {
    const { router } = renderPopup(new Project(BASE), open());

    await userEvent.click(screen.getByRole('link', { name: 'View comment period' }));

    expect(track).toHaveBeenCalledWith('Comment Period Banner Clicked', {
      project_id: 'proj-1',
      project_name: 'Cedar Quarry',
      status: 'Open',
      is_met: false,
      destination: 'comment_period_details',
      source: 'map_popup',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/cp/cp1/details'));
  });

  it('tracks an ENGAGE banner click from a list card as external', async () => {
    renderPopup(
      new Project(BASE),
      open({ isMet: true, metURL: 'https://engage.eao.gov.bc.ca/cedar-quarry' }),
      'inline',
    );

    await userEvent.click(
      screen.getByRole('link', { name: 'Share your thoughts (opens in new tab)' }),
    );

    expect(track).toHaveBeenCalledWith('Comment Period Banner Clicked', {
      project_id: 'proj-1',
      project_name: 'Cedar Quarry',
      status: 'Open',
      is_met: true,
      destination: 'external_met',
      source: 'list_accordion',
    });
  });

  it('tracks the unsafe-scheme fallback as the in-app page it opens', async () => {
    renderPopup(new Project(BASE), open({ isMet: true, metURL: 'javascript:alert(1)' }));

    await userEvent.click(screen.getByRole('link', { name: 'View comment period' }));

    expect(track).toHaveBeenCalledWith(
      'Comment Period Banner Clicked',
      expect.objectContaining({ is_met: false, destination: 'comment_period_details' }),
    );
  });

  it('puts focus on the project heading, described by the banner, when the map card opens with one', () => {
    renderPopup(new Project(BASE), open());

    const heading = screen.getByRole('heading', { name: 'Cedar Quarry' });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAccessibleDescription(/^Open for public comment Mar 3, 2020 – /);
  });

  it('puts the banner first in Tab order in the inline accordion, where it is drawn first', async () => {
    renderPopup(new Project(BASE), open(), 'inline');

    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'View comment period' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'View project' })).toHaveFocus();
  });

  it('describes the heading by the banner title alone when the period has no dates', () => {
    renderPopup(new Project(BASE), open({ dateStarted: null, dateCompleted: null }));

    expect(screen.getByRole('heading', { name: 'Cedar Quarry' })).toHaveAccessibleDescription(
      'Open for public comment',
    );
  });

  it('reaches the banner link by Tab from the focused heading, though the banner sits above', async () => {
    renderAt('/', [
      {
        path: '/',
        element: (
          <>
            <ProjDetailPopup
              project={new Project({ ...BASE, description: 'Long text. '.repeat(30) })}
              engagement={open({ isMet: true, metURL: 'https://engage.example.org/cedar' })}
              onClose={() => undefined}
            />
            {/* Page content after the card, so Tab cannot wrap round to the top of the document. */}
            <button type="button">Next on the page</button>
          </>
        ),
      },
    ]);
    expect(screen.getByRole('heading', { name: 'Cedar Quarry' })).toHaveFocus();

    const path: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      const focused = document.activeElement;
      path.push(focused?.getAttribute('aria-label') ?? focused?.textContent ?? null);
    }

    expect(path).toEqual([
      'Close',
      'More',
      'View project',
      expect.stringContaining('Share your thoughts'),
    ]);
  });

  it('puts focus on the project heading when the map card opens without a banner', () => {
    renderPopup(new Project(BASE));

    expect(screen.getByRole('heading', { name: 'Cedar Quarry' })).toHaveFocus();
  });
});
