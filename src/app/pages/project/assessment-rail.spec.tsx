import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Phase } from 'app/api/project-phases';
import type { Project } from 'app/models/project';
import { renderAt } from '../../../test-utils';
import { AssessmentRail } from './assessment-rail';
import { simplifiedStages, withPhaseDates } from './assessment-stages';
import { LISTS, PHASES, makeProject } from './assessment-stages.fixture';

function renderElement(element: ReactNode) {
  return renderAt('/p/proj-1/overview', [
    { path: '/p/:projId/overview', element },
    { path: '/p/:projId/timeline', element: <p>Timeline tab</p> },
  ]);
}

/** The rail as its callers build it: the Act's stages, dated from Track's phases. */
function railFor(project: Project | null, phases: Phase[] | null = null) {
  return (
    <AssessmentRail
      project={project}
      stages={withPhaseDates(simplifiedStages(LISTS, project), phases)}
    />
  );
}

function renderRail(
  phase: string | null,
  phaseYear = 2018,
  act = phaseYear,
  phases: Phase[] | null = null,
) {
  return renderElement(railFor(makeProject(phase, phaseYear, act), phases));
}

function renderProject(project: Partial<Project>) {
  return renderElement(railFor(project as Project));
}

describe('simplified rail', () => {
  it('lists the eight 2018 phases and marks the current one', () => {
    renderRail('Process Planning');

    expect(screen.getByRole('heading', { name: 'Assessment progress' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(8);
    expect(items[0]).toHaveTextContent('Project Designation');
    expect(items[7]).toHaveTextContent('Post decision');
    expect(items[3]).toHaveAttribute('aria-current', 'step');
    expect(items.filter((item) => item.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('draws the seven 2002 phases with the Act name', () => {
    renderRail('Application Review', 2002);

    expect(screen.getByText('2002 Environmental Assessment Act')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('offers no Simplified or Detailed toggle', () => {
    renderRail('Process Planning');

    expect(screen.getByText('2018 Environmental Assessment Act')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Detailed' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Simplified' })).toBeNull();
  });

  it('names an off-rail phase instead of marking a current stage', () => {
    renderRail('Withdrawal', 2002);

    expect(screen.getByText(/current phase is Withdrawal/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { current: 'step' })).toBeNull();
  });

  it('draws the 2018 phases with no Act name when the label has no year', () => {
    renderProject({ ...makeProject(null), legislation: 'Environmental Assessment Act' });

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.queryByText('Environmental Assessment Act')).toBeNull();
  });

  it('renders nothing for a project under the federal Building Canada Act', () => {
    const { container } = renderProject({
      ...makeProject('Process Planning'),
      legislation: 'Building Canada Act',
    });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('View timeline link', () => {
  it('links to the project timeline tab', () => {
    renderRail('Application Review', 2002);

    expect(screen.getByRole('link', { name: 'View timeline' })).toHaveAttribute(
      'href',
      '/p/proj-1/timeline',
    );
  });

  it('opens the timeline tab when followed', async () => {
    const { router } = renderRail('Process Planning');

    await userEvent.click(screen.getByRole('link', { name: 'View timeline' }));

    expect(await screen.findByText('Timeline tab')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/p/proj-1/timeline');
  });

  it('is hidden while the project is still loading', () => {
    renderElement(<AssessmentRail project={null} stages={[]} loading />);

    expect(screen.getByText('Loading assessment progress')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View timeline' })).toBeNull();
  });
});

describe('phase dates', () => {
  it('puts a date line under each simplified stage DEMI has phases for', () => {
    renderRail('Process Planning', 2018, 2018, PHASES);

    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveTextContent('Early EngagementCompletedJul 2025 – Jun 2026');
    expect(items[4]).toHaveTextContent('Application Development and ReviewNov 2026 – Oct 2027');
    expect(items[5]).toHaveTextContent('Effects AssessmentJan – Jun 2028');
    expect(items[6]).toHaveTextContent('ReferralJun – Jul 2028');
    // Project Designation is not a Track phase, so it has a name and nothing else.
    expect(items[0]).toHaveTextContent(/^Project DesignationCompleted$/);
  });

  it('renders the rail unchanged while the phases are still loading', () => {
    renderRail('Process Planning');

    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(/^Early EngagementCompleted$/);
  });
});
