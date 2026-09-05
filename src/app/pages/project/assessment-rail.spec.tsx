import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Phase } from 'app/api/project-phases';
import { AssessmentRail } from './assessment-rail';
import { LISTS, PHASES, makeProject } from './assessment-stages.fixture';

function renderRail(
  phase: string | null,
  phaseYear = 2018,
  act = phaseYear,
  phases: Phase[] | null = null,
) {
  return render(
    <AssessmentRail project={makeProject(phase, phaseYear, act)} lists={LISTS} phases={phases} />,
  );
}

async function showDetailed() {
  await userEvent.click(screen.getByRole('button', { name: 'Detailed' }));
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

  it('offers no detailed view on a project in the 2002 phase set', () => {
    renderRail('Application Review', 2002);

    expect(screen.queryByRole('group', { name: 'Progress detail' })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('shows the Act name with no Detailed button for a 2002 Act project', () => {
    renderRail('Application Review', 2002);

    expect(screen.getByText('2002 Environmental Assessment Act')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Detailed' })).toBeNull();
  });

  it('shows the Act name and the Detailed button for a 2018 Act project', () => {
    renderRail('Process Planning');

    expect(screen.getByText('2018 Environmental Assessment Act')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detailed' })).toBeInTheDocument();
  });

  it('keeps the detailed view from a 2002 Act project sitting in a 2018 phase', () => {
    renderRail('Complete', 2018, 2002);

    expect(screen.queryByRole('button', { name: 'Detailed' })).toBeNull();
  });

  it('names an off-rail phase instead of marking a current stage', () => {
    renderRail('Withdrawal', 2002);

    expect(screen.getByText(/current phase is Withdrawal/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { current: 'step' })).toBeNull();
  });
});

describe('phase dates', () => {
  it('puts a date line under each simplified stage DEMI has phases for', () => {
    renderRail('Effects Assessment', 2018, 2018, PHASES);

    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveTextContent('Early EngagementAug 2020 – Mar 2021');
    expect(items[5]).toHaveTextContent('Effects AssessmentSince Feb 2023');
    // Project Designation is not a Track phase, so it has a name and nothing else.
    expect(items[0]).toHaveTextContent(/^Project Designation$/);
  });

  it('adds the dates after the clock in each detailed key row', async () => {
    renderRail('Effects Assessment', 2018, 2018, PHASES);

    await showDetailed();

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('90 days EAO limit · Aug 2020 – Jan 2021');
    expect(rows[7]).toHaveTextContent('110 days EAO limit · Since Feb 2023');
    expect(rows[8]).toHaveTextContent(/40 days EAO limit$/);
  });

  it('renders the rail unchanged while the phases are still loading', () => {
    renderRail('Effects Assessment');

    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(/^Early Engagement$/);
  });
});

describe('detailed rail', () => {
  it('exposes only the numbered key as a list', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();

    expect(screen.getByRole('button', { name: 'Detailed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Simplified' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(container.querySelectorAll('.assessment-rail__seg')).toHaveLength(10);
    expect(container.querySelectorAll('.assessment-rail__seg--striped')).toHaveLength(3);

    // bar and pins are aria-hidden, so every listitem here belongs to the key
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.querySelector('.assessment-rail__chip')?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(rows[0]).toHaveTextContent('Early Engagement');
    expect(rows[4]).toHaveTextContent('3 years proponent time');
    expect(rows[9]).toHaveTextContent('30 days EAO limit');
  });

  it('states the EAO share of the timeline', async () => {
    renderRail('Process Planning');

    await showDetailed();

    expect(
      screen.getByText(
        /maximum timeline of 6\.7 years\. Of that, 630 days \(26%\).+remaining 1,825 days are proponent time/,
      ),
    ).toBeInTheDocument();
  });

  it('centres every pin under its segment on one row', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();

    const segments = container.querySelectorAll<HTMLElement>('.assessment-rail__seg');
    const pins = container.querySelectorAll<HTMLElement>('.assessment-rail__pin');
    expect(pins).toHaveLength(10);
    pins.forEach((pin, index) => {
      const segment = segments[index];
      const start = Number.parseFloat(segment.style.getPropertyValue('--l'));
      const width = Number.parseFloat(segment.style.getPropertyValue('--w'));
      expect(Number.parseFloat(pin.style.getPropertyValue('--l'))).toBeCloseTo(
        start + width / 2,
        1,
      );
      // No row var and no rows count: pins never stack off the track.
      expect(pin.style.getPropertyValue('--row')).toBe('');
    });
    expect(
      container
        .querySelector<HTMLElement>('.assessment-rail__pins')
        ?.style.getPropertyValue('--rows'),
    ).toBe('');
  });

  it('links a key row to its segment and pin on hover', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();
    await userEvent.hover(screen.getAllByRole('listitem')[4]);

    expect(container.querySelector('.assessment-rail__seg[data-stage="5"]')).toHaveAttribute(
      'data-hover',
    );
    expect(container.querySelector('.assessment-rail__pin[data-stage="5"]')).toHaveAttribute(
      'data-hover',
    );
    expect(container.querySelector('.assessment-rail__seg[data-stage="1"]')).not.toHaveAttribute(
      'data-hover',
    );

    await userEvent.unhover(screen.getAllByRole('listitem')[4]);

    expect(container.querySelector('.assessment-rail__seg[data-stage="5"]')).not.toHaveAttribute(
      'data-hover',
    );
  });

  it('marks finished, current and upcoming stages', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();

    const rows = container.querySelectorAll('.assessment-rail__key-row');
    expect(rows[2]).toHaveClass('assessment-rail__key-row--done');
    expect(rows[3]).toHaveAttribute('aria-current', 'step');
    expect(rows[4]).toHaveClass('assessment-rail__key-row--upcoming');
    expect(container.querySelectorAll('.assessment-rail__seg--done')).toHaveLength(3);
    expect(container.querySelectorAll('.assessment-rail__seg--current')).toHaveLength(1);
  });

  it('marks one current step when a phase spans several stages', async () => {
    const { container } = renderRail('Application Development and Review');

    await showDetailed();

    expect(container.querySelectorAll('.assessment-rail__key-row--current')).toHaveLength(3);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });

  it('keeps the amendment column off the rail before the decision', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();

    expect(container.querySelector('.assessment-rail__amendment')).toBeNull();
  });

  it('keeps the amendment column off the rail for other post-decision phases', async () => {
    const { container } = renderRail('Post Decision - Construction');

    await showDetailed();

    expect(container.querySelector('.assessment-rail__amendment')).toBeNull();
  });

  it('adds the off-scale amendment column after the decision', async () => {
    renderRail('Post Decision - Amendment');

    await showDetailed();

    expect(screen.getByText('In progress · no legislated duration')).toBeInTheDocument();
  });
});
