import { openPhaseOf, type Phase, type Work } from 'app/api/project-phases';
import { useBcToday } from 'app/components/use-bc-today';
import { dayOf } from 'app/utils/utils';
import { dateLabel, FILLS } from './assessment-stages';
import { RailFrame, SimpleRail, type RailStep } from './assessment-rail';
import { at } from './use-timeline-model';

interface WorkRailProps {
  work: Work;
  kind: 'eaWork' | 'postDecisionWork';
}

// Track's planned dates are often past or reversed, so only actual ones are shown.
function datesFor(phase: Phase, state: RailStep['state'], today: string): string | undefined {
  if (state === 'done') {
    const from = at(phase.startDate);
    const to = at(phase.endDate);
    // Track can store the end before the start; the phase finished at the end date.
    return dateLabel(from != null && to != null && to < from ? null : from, to) || undefined;
  }
  if (state === 'upcoming') return undefined;
  const start = at(phase.startDate);
  return start != null && dayOf(phase.startDate) <= today ? dateLabel(start, null) : undefined;
}

/** One Track work's phases in DEMI order: completed ones done, the first open one current. */
export function WorkRail({ work, kind }: WorkRailProps) {
  const today = useBcToday();
  if (!work.phases.length) return null;
  const open = openPhaseOf(work);
  // The Timeline tab's post-decision colour; purple stays the Decision phase's.
  const fill = kind === 'postDecisionWork' ? FILLS.amendment : FILLS.processPlanning;

  const stages = work.phases.map((phase, index): RailStep => {
    const state: RailStep['state'] = phase.isCompleted
      ? 'done'
      : phase === open
        ? 'current'
        : 'upcoming';
    return {
      id: `${index}-${phase.name}`,
      n: index + 1,
      name: phase.name,
      state,
      dates: datesFor(phase, state, today),
      ...fill,
    };
  });

  return (
    <RailFrame title={`${work.workType} progress`} headless>
      <SimpleRail stages={stages} />
    </RailFrame>
  );
}
