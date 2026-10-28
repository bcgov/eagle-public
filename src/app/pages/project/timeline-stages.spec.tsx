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
  it('lists the six stages in order, Care and Maintenance as optional', () => {
    render(<StagesAfterCertificate current="Completed" />);

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Preconstruction',
      'Construction',
      'Operation',
      'Care and MaintenanceOptional',
      'Decommissioning',
      'CompletedCurrent stage',
    ]);
    expect(screen.getByText('Only the current stage is recorded. Stages are not dated.')).toBeVisible();
  });

  it.each([null, 'Inactive'])('marks no stage for %s', (current) => {
    render(<StagesAfterCertificate current={current} />);

    expect(screen.getByText('Current stage: Not recorded')).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').filter((li) => li.hasAttribute('aria-current')),
    ).toEqual([]);
  });
});
