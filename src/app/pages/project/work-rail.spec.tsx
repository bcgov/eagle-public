import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Phase, Work } from 'app/api/project-phases';
import { TODAY } from './timeline.fixture';
import { WorkRail } from './work-rail';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
});

afterEach(() => vi.useRealTimers());

const phase = (name: string, fields: Partial<Phase> = {}): Phase =>
  ({ name, startDate: null, endDate: null, isCompleted: false, ...fields }) as Phase;

function renderRail(phases: Phase[]) {
  const work = { workType: 'Amendment', phases } as unknown as Work;
  return render(<WorkRail work={work} kind="postDecisionWork" />);
}

const stages = () =>
  within(screen.getByRole('region', { name: 'Amendment progress' })).getAllByRole('listitem');

describe('WorkRail', () => {
  it('marks completed phases done, the first open one current, the rest upcoming', () => {
    renderRail([phase('Intake', { isCompleted: true }), phase('Review'), phase('Decision')]);

    const [intake, review, decision] = stages();
    expect(intake).toHaveTextContent(/^IntakeCompleted$/);
    expect(review).toHaveAttribute('aria-current', 'step');
    expect(decision).not.toHaveAttribute('aria-current');
    expect(decision).toHaveTextContent(/^Decision$/);
  });

  it('names its section by the work type, with no heading of its own', () => {
    renderRail([phase('Review')]);

    expect(screen.getByRole('region', { name: 'Amendment progress' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('dates a completed phase by its actual range', () => {
    renderRail([
      phase('Intake', {
        isCompleted: true,
        startDate: '2026-02-03T00:00:00.000Z',
        endDate: '2026-05-01T00:00:00.000Z',
      }),
    ]);

    expect(stages()[0]).toHaveTextContent('IntakeCompletedFeb – May 2026');
  });

  it('dates a completed phase Track ended before its start by the end alone', () => {
    renderRail([
      phase('Intake', {
        isCompleted: true,
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2025-11-01T00:00:00.000Z',
      }),
    ]);

    expect(stages()[0]).toHaveTextContent(/^IntakeCompletedNov 2025$/);
  });

  it('says since when the current phase started, once that day has come in BC', () => {
    renderRail([phase('Review', { startDate: '2026-10-26T00:00:00.000Z' })]);

    expect(stages()[0]).toHaveTextContent(/^ReviewSince Oct 2026$/);
  });

  it('leaves a current phase that starts after today undated', () => {
    renderRail([phase('Review', { startDate: '2026-10-27T00:00:00.000Z' })]);

    expect(stages()[0]).toHaveTextContent(/^Review$/);
  });

  it("never shows an upcoming phase's planned dates", () => {
    renderRail([
      phase('Review'),
      phase('Decision', {
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-12-01T00:00:00.000Z',
      }),
    ]);

    expect(stages()[1]).toHaveTextContent(/^Decision$/);
  });

  it('draws nothing for work with no phases', () => {
    const { container } = renderRail([]);

    expect(container).toBeEmptyDOMElement();
  });
});
