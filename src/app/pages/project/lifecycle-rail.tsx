import { FILLS } from './assessment-stages';
import { RailFrame, SimpleRail, type RailStep } from './assessment-rail';
import { STAGE_NOT_RECORDED_NOTE, STAGES_UNDATED_NOTE } from './timeline-stages';
import { stagesAfterCertificateFor } from './use-timeline-model';

interface LifecycleRailProps {
  /** The stage after the certificate; `null` when none is recorded. */
  stage: string | null;
}

/** The stages after the certificate. Only the current one is known, and none is dated. */
export function LifecycleRail({ stage }: LifecycleRailProps) {
  const names = stagesAfterCertificateFor(stage);
  const currentIndex = stage ? names.indexOf(stage) : -1;

  const stages = names.map((name, index): RailStep => {
    const state: RailStep['state'] =
      index === currentIndex ? 'current' : index < currentIndex ? 'done' : 'upcoming';
    const aside = index === currentIndex ? 'Current stage' : undefined;
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
