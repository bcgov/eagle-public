import { FILLS } from './assessment-stages';
import { RailFrame, SimpleRail, type RailStep } from './assessment-rail';
import { STAGE_NOT_RECORDED_NOTE, STAGES_UNDATED_NOTE } from './timeline-stages';
import { OPTIONAL_STAGE, STAGES_AFTER_CERTIFICATE, stageReached } from './use-timeline-model';

interface LifecycleRailProps {
  /** The stage after the certificate; `null` when none is recorded. */
  stage: string | null;
}

/** The six stages after the certificate. Only the current one is known, and none is dated. */
export function LifecycleRail({ stage }: LifecycleRailProps) {
  const currentIndex = stage ? STAGES_AFTER_CERTIFICATE.indexOf(stage) : -1;

  const stages = STAGES_AFTER_CERTIFICATE.map((name, index): RailStep => {
    const optional = name === OPTIONAL_STAGE;
    const state: RailStep['state'] =
      index === currentIndex ? 'current' : stageReached(index, currentIndex) ? 'done' : 'upcoming';
    const aside = index === currentIndex ? 'Current stage' : optional ? 'Optional' : undefined;
    return { id: name, n: index + 1, name, state, aside, ...FILLS.amendment };
  });

  return (
    <RailFrame title="Project lifecycle" headless>
      <SimpleRail stages={stages} />
      <p
        className={`assessment-rail__caption${currentIndex < 0 ? ' assessment-rail__caption--missing' : ''}`}
      >
        {currentIndex < 0 ? STAGE_NOT_RECORDED_NOTE : STAGES_UNDATED_NOTE}
      </p>
    </RailFrame>
  );
}
