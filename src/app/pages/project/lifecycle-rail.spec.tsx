import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LifecycleRail } from './lifecycle-rail';

const region = () => screen.getByRole('region', { name: 'Project lifecycle' });
const stages = () => within(region()).getAllByRole('listitem');
const named = (name: string) => stages().find((stage) => stage.textContent?.startsWith(name))!;

describe('LifecycleRail', () => {
  it('draws the six stages after the certificate and marks the current one', () => {
    render(<LifecycleRail stage="Operation" />);

    expect(stages().map((stage) => stage.title)).toEqual([
      'Preconstruction',
      'Construction',
      'Operation',
      'Care and Maintenance',
      'Decommissioning',
      'Completed',
    ]);
    expect(within(region()).getByRole('listitem', { current: 'step' })).toBe(named('Operation'));
    expect(region()).toHaveTextContent('Only the current stage is recorded. Stages are not dated.');
  });

  it('fills the stages before the current one, but never the optional one', () => {
    render(<LifecycleRail stage="Decommissioning" />);

    expect(named('Construction')).toHaveTextContent('Completed');
    expect(named('Operation')).toHaveTextContent('Completed');
    // It may have been skipped, so it reads "Optional", not done.
    expect(named('Care and Maintenance')).toHaveTextContent(/^Care and MaintenanceOptional$/);
  });

  it('labels the current stage for sighted readers only, as aria-current already says so', () => {
    render(<LifecycleRail stage="Construction" />);

    const aside = within(named('Construction')).getByText('Current stage');
    expect(aside).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    ['no stage', null],
    ['a stage the lifecycle does not hold', 'Under Work'],
  ])('says the stage is not recorded for %s', (_name, stage) => {
    render(<LifecycleRail stage={stage} />);

    expect(region()).toHaveTextContent('Current stage: Not recorded');
    expect(within(region()).queryByRole('listitem', { current: 'step' })).toBeNull();
    expect(within(region()).queryByText('Completed', { selector: '.visually-hidden' })).toBeNull();
  });
});
