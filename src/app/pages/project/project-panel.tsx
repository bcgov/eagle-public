import { lazy, Suspense } from 'react';
import type { Project } from 'app/models/project';
import { longDate } from 'app/utils/utils';
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
}

interface FactProps {
  label: string;
  value?: string;
  /** Second line under the value, e.g. the decision date or the region. */
  detail?: string;
  loading: boolean;
}

function Fact({ label, value, detail, loading }: FactProps) {
  return (
    <div className="project-panel__fact">
      <dt>{label}</dt>
      <dd>
        {loading ? (
          <span className="placeholder col-8" aria-hidden="true"></span>
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
export function ProjectPanel({ project, lists, loading = false }: ProjectPanelProps) {
  const centroid = project?.centroid?.length === 2 ? project.centroid : null;

  return (
    <section className="project-panel" aria-label="Project summary">
      <div className="project-panel__progress">
        <AssessmentRail project={project} lists={lists} />
      </div>

      <div className="project-panel__facts">
        <dl className={loading ? 'placeholder-wave' : undefined} aria-busy={loading || undefined}>
          <Fact label="Status" value={project?.currentPhaseName?.name} loading={loading} />
          <Fact
            label="EA decision"
            value={project?.eacDecision?.name}
            detail={project?.decisionDate ? longDate(project.decisionDate) : undefined}
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

        {loading ? (
          <div className="map-container">
            <span className="placeholder w-100 h-100" aria-hidden="true" />
          </div>
        ) : centroid && project ? (
          <div className="map-container">
            <Suspense fallback={<span className="placeholder w-100 h-100" aria-hidden="true" />}>
              <DetailsMap project={project} />
            </Suspense>
          </div>
        ) : (
          <div className="map-placeholder">
            <span>No map available</span>
          </div>
        )}
      </div>
    </section>
  );
}
