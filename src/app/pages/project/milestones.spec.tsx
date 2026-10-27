import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Milestones } from './milestones';
import type { TimelineMilestone } from './use-timeline-model';

function step(name: string, date: string, fields: Partial<TimelineMilestone> = {}) {
  return {
    name,
    date,
    planned: false,
    outcome: null,
    decision: null,
    stop: false,
    ...fields,
  } satisfies TimelineMilestone;
}

const EXTENSION = [
  step('Request received', '2025-04-07'),
  step('Decision', '2025-05-26', { outcome: 'Approved', decision: 'approved' }),
];

const JOINT_COMPLEX_AMENDMENT = [
  step('Application received', '2026-08-03'),
  step('Accepted for review', '2026-08-24'),
  step('Engagement plan', '2026-09-28'),
  step('Public comment', '2026-11-16', { planned: true }),
  step('Referral', '2027-03-01', { planned: true }),
  step('Decision', '2027-05-10', { planned: true }),
];

const items = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('Milestones', () => {
  it('lists two milestones under a counted heading, the decision carrying its outcome', () => {
    render(<Milestones milestones={EXTENSION} />);

    expect(screen.getByRole('heading', { name: 'Milestones · 2' })).toBeInTheDocument();
    expect(items().map((li) => li.textContent)).toEqual([
      'checkRequest received7 Apr 2025',
      'checkDecision: Approved26 May 2025',
    ]);
  });

  it('lists six milestones, the planned ones hollow and tagged Planned', () => {
    render(<Milestones milestones={JOINT_COMPLEX_AMENDMENT} />);

    expect(screen.getByRole('heading', { name: 'Milestones · 6' })).toBeInTheDocument();
    const [, , done, planned] = items();
    expect(within(done).getByText('check')).toBeInTheDocument();
    expect(within(done).queryByText('Planned')).not.toBeInTheDocument();
    expect(within(planned).queryByText('check')).not.toBeInTheDocument();
    expect(within(planned).getByText('Planned')).toBeInTheDocument();
    expect(screen.getAllByText('Planned')).toHaveLength(3);
  });

  it('draws a refusal as a stop with a cross', () => {
    render(
      <Milestones
        milestones={[step('Decision', '2024-02-01', { decision: 'refused', stop: true })]}
      />,
    );

    expect(items()[0]).toHaveTextContent('closeDecision: Refused1 Feb 2024');
  });

  it('names a stop with no decision as it is, such as a closed work', () => {
    render(
      <Milestones milestones={[step('Ended with no decision', '2024-02-01', { stop: true })]} />,
    );

    expect(items()[0]).toHaveTextContent('closeEnded with no decision');
  });
});
