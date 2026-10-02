import { lazy, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import { longDate } from 'app/utils/utils';
import { useProjectEaCertificate, useProjectPhases } from 'app/api/project-phases';
import { explorerLink } from 'app/pages/projects/explorer-link';
import { actFor } from 'app/utils/legislation';
import { AssessmentRail } from './assessment-rail';
import type { PhaseListItem } from './assessment-stages';
import './project-panel.css';

// maplibre-gl is ~1 MB; keep it and its wrapper out of the main bundle until this map renders.
const DetailsMap = lazy(() => import('./details-map').then((m) => ({ default: m.DetailsMap })));

interface ProjectPanelProps {
  project: Project | null;
  /** Every List row; the rail picks the projectPhase ones out. */
  lists: PhaseListItem[];
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
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

/** "14 March 2023 · E23-01" under the EA decision fact, either half omitted when absent. */
function eaDecisionMeta(
  decisionDate: string | undefined,
  eaCertificate: string | undefined,
  projId: string,
) {
  const date = decisionDate ? longDate(decisionDate) : undefined;
  const certificate = eaCertificate && <Link to={`/p/${projId}/decisions`}>{eaCertificate}</Link>;
  if (date && certificate)
    return (
      <>
        {date} · {certificate}
      </>
    );
  return date ?? certificate ?? undefined;
}

/** The card under the masthead: assessment progress beside the core project facts, on every tab. */
export function ProjectPanel({
  project,
  lists,
  loading = false,
  isNotification = false,
  parts = {},
}: ProjectPanelProps) {
  const centroid = project?.centroid?.length === 2 ? project.centroid : null;
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
          detail={eaDecisionMeta(project?.decisionDate, eaCertificate, projId)}
          loading={loading}
        />
        <Fact label="Type" value={project?.type} loading={loading} />
        <Fact
          label="Location"
          value={project?.location}
          detail={project?.region ? `${project.region} region` : undefined}
          loading={loading}
        />
        <Fact label="Proponent" value={project?.proponent?.name} loading={loading} />
      </dl>
    </>
  );

  const locationMap = (
    <div className="project-panel__map">
      {loading ? (
        <div className="map-container">
          <Skeleton height="100%" />
        </div>
      ) : centroid && project ? (
        <>
          <div className="map-container">
            <Suspense fallback={<Skeleton height="100%" />}>
              <DetailsMap project={project} />
            </Suspense>
          </div>
          <Link
            className="project-panel__map-link"
            to={notification ? '/projects' : explorerLink(project)}
          >
            <span className="link-label">Open in map explorer</span>
            <span className="material-icons" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </>
      ) : (
        <div className="map-placeholder">
          <span>No map available</span>
        </div>
      )}
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
            <AssessmentRail project={project} lists={lists} phases={phases} loading={loading} />
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
