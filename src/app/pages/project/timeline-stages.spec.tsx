import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { stageSetFor } from './assessment-stages';
import { StagesAfterCertificate, TimelineStages } from './timeline-stages';

const [preEa, preApplication] = stageSetFor(2002);

describe('TimelineStages', () => {
  it('lists each phase with its steps under the label', () => {
    render(
      <TimelineStages
        label="Phases and steps under the 2002 Act"
        rows={[{ row: preApplication, onProject: true }]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Phases and steps under the 2002 Act' }),
    ).toBeInTheDocument();
    const [item] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(item).toHaveTextContent(
      'Pre-ApplicationS.11 Order · Application Information Requirements Accepted',
    );
  });

  it('says which phases the project did not go through', () => {
    render(
      <TimelineStages
        label="Phases"
        rows={[
          { row: preEa, onProject: false },
          { row: preApplication, onProject: true },
        ]}
      />,
    );

    expect(screen.getByText('Pre-EA (not on this project)')).toBeInTheDocument();
    expect(screen.getByText('Pre-Application')).toBeInTheDocument();
  });
});

describe('StagesAfterCertificate', () => {
  const names = () => screen.getAllByRole('listitem').map((li) => li.textContent);

  it('lists the stages in order, leaving out Care and Maintenance', () => {
    render(<StagesAfterCertificate current="Completed" />);

    expect(names()).toEqual([
      'PreconstructionCompleted',
      'ConstructionCompleted',
      'OperationCompleted',
      'DecommissioningCompleted',
      'CompletedCurrent stage',
    ]);
    expect(
      screen.getByText('Only the current stage is recorded. Stages are not dated.'),
    ).toBeVisible();
  });

  it('lists Care and Maintenance while it is the current stage', () => {
    render(<StagesAfterCertificate current="Care and Maintenance" />);

    expect(names()).toEqual([
      'PreconstructionCompleted',
      'ConstructionCompleted',
      'OperationCompleted',
      'Care and MaintenanceCurrent stage',
      'Decommissioning',
      'Completed',
    ]);
    const current = screen.getByRole('listitem', { current: 'step' });
    expect(current).toHaveTextContent('Care and Maintenance');
    expect(within(current).getByText('Current stage')).toHaveAttribute('aria-hidden', 'true');
  });

  it('fills the bars up to and including the current stage', () => {
    render(<StagesAfterCertificate current="Decommissioning" />);
    const stage = (name: string) =>
      screen.getByText(name, { selector: '.timeline-after__name' }).closest('li');

    expect(stage('Operation')).toHaveClass('timeline-after__stage--reached');
    expect(stage('Decommissioning')).toHaveClass('timeline-after__stage--reached');
    expect(stage('Completed')).not.toHaveClass('timeline-after__stage--reached');
  });

  it.each([null, 'Inactive'])('marks no stage for %s', (current) => {
    render(<StagesAfterCertificate current={current} />);

    expect(screen.getByText('Current stage: Not recorded')).toBeInTheDocument();
    expect(names()).toEqual([
      'Preconstruction',
      'Construction',
      'Operation',
      'Decommissioning',
      'Completed',
    ]);
    expect(screen.queryByRole('listitem', { current: 'step' })).toBeNull();
  });
});
