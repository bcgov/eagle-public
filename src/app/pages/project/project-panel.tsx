import type { ReactNode } from 'react';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import { useProjectEaCertificate, useProjectPhases } from 'app/api/project-phases';
import { actFor } from 'app/utils/legislation';
import { projectPlace } from 'app/utils/project-place';
import { AssessmentRail } from './assessment-rail';
import type { PhaseListItem } from './assessment-stages';
import { eaDecisionDetail } from './ea-decision-detail';
import { ProjectLocationMap } from './project-location-map';
import './project-panel.css';

interface ProjectPanelProps {
  project: Project | null;
  /** Every List row; the rail picks the projectPhase ones out. */
  lists: PhaseListItem[];
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
  /** The List rows are still in flight; only the rail waits on them. */
  listsLoading?: boolean;
  /** Known from the route before the record loads; the record's own flag covers the rest. */
  isNotification?: boolean;
  /** An extended project page's own parts, each drawn in place of the standard one when set. */
  parts?: PanelParts;
}

/** Stand-ins for the assessment rail, the record facts and the location map. */
export interface PanelParts {
  progress?: ReactNode;
  facts?: ReactNode;
  map?: ReactNode;
}

interface FactProps {
  label: string;
  value?: ReactNode;
  /** Second line under the value, e.g. the decision date or the region. */
  detail?: ReactNode;
  loading: boolean;
}

/** One `dt`/`dd` pair of the panel's facts. */
export function Fact({ label, value, detail, loading }: FactProps) {
  return (
    <div className="project-panel__fact">
      <dt>{label}</dt>
      <dd>
        {loading ? (
          <Skeleton width="70%" />
        ) : (
          <>
            {value || '-'}
            {detail && <span className="project-panel__fact-detail">{detail}</span>}
          </>
        )}
      </dd>
    </div>
  );
}

/** The card under the masthead: assessment progress beside the core project facts, on every tab. */
export function ProjectPanel({
  project,
  lists,
  loading = false,
  listsLoading = false,
  isNotification = false,
  parts = {},
}: ProjectPanelProps) {
  const notification = isNotification || !!project?.notification;
  // DEMI has no phases or certificate for a notification; an empty id keeps those reads off, as
  // it does for a part the page draws itself.
  const projId = project && !notification ? project._id : '';
  // A notification has no assessment stages (the rail would show every one as upcoming), nor does
  // a project under an Act without a stage model.
  const showProgress =
    !notification && (!!parts.progress || actFor(project?.legislation)?.stages !== 'none');
  const phases = useProjectPhases(parts.progress || !showProgress ? '' : projId);
  const eaCertificate = useProjectEaCertificate(parts.facts ? '' : projId);

  const recordFacts = (
    <>
      {loading && (
        <span className="visually-hidden">
          {notification ? 'Loading project notification summary' : 'Loading project summary'}
        </span>
      )}
      <dl>
        <Fact label="Status" value={project?.currentPhaseName?.name} loading={loading} />
        <Fact
          label={notification ? 'Decision' : 'EA decision'}
          value={project?.eacDecision?.name}
          detail={eaDecisionDetail(project?.decisionDate, eaCertificate, projId)}
          loading={loading}
        />
        <Fact label="Type" value={project?.type} loading={loading} />
        <Fact
          label="Location"
          value={project?.location}
          detail={projectPlace({ region: project?.region })}
          loading={loading}
        />
        <Fact label="Proponent" value={project?.proponent?.name} loading={loading} />
      </dl>
    </>
  );

  const locationMap = (
    <div className="project-panel__map">
      <ProjectLocationMap project={project} loading={loading} notification={notification} />
    </div>
  );

  return (
    <section
      className="project-panel"
      aria-label={notification ? 'Project notification summary' : 'Project summary'}
      aria-busy={loading || undefined}
    >
      {showProgress && (
        <div className="project-panel__progress">
          {parts.progress ?? (
            <AssessmentRail
              project={project}
              lists={lists}
              phases={phases}
              loading={loading || listsLoading}
            />
          )}
        </div>
      )}

      <div className="project-panel__facts">
        {parts.facts ?? recordFacts}
        {parts.map ?? locationMap}
      </div>
    </section>
  );
}
