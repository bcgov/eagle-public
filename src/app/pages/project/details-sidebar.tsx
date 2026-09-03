import { lazy, Suspense } from 'react';
import type { Project } from 'app/models/project';
import { Constants } from 'app/utils/constants';
import './details-sidebar.css';

// maplibre-gl is ~1 MB; keep it and its wrapper out of the main bundle until this map renders.
const DetailsMap = lazy(() => import('./details-map').then((m) => ({ default: m.DetailsMap })));

interface DetailsSidebarProps {
  project: Project | null;
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
  open: boolean;
  onToggle: () => void;
}

function legislationLink(project: Project | null): string {
  const legislation = project?.legislation ?? '';
  if (legislation.includes('2002')) {
    return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK;
  }
  if (legislation.includes('1996')) {
    return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK;
  }
  return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK;
}

export function DetailsSidebar({ project, loading = false, open, onToggle }: DetailsSidebarProps) {
  const centroid = project?.centroid?.length === 2 ? project.centroid : null;

  return (
    <div className="sidebar-wrapper">
      <aside className={`side-banner p-0${open ? '' : ' closed'}`}>
        <div
          className={`sidebar-content${loading ? ' placeholder-wave' : ''}`}
          aria-busy={loading || undefined}
        >
          {loading && <span className="visually-hidden">Loading project</span>}
          <h1 className="project-name">
            {loading ? (
              <span className="placeholder col-9" aria-hidden="true"></span>
            ) : (
              project?.name || '-'
            )}
          </h1>

          <div className="info-section">
            <div className="info-block">
              <span className="info-label">Environmental Assessment</span>
              <p>
                {loading ? (
                  <span className="ea-decision placeholder col-7" aria-hidden="true">
                    {'\u00a0'}
                  </span>
                ) : (
                  <span className="ea-decision">{project?.eacDecision?.name || '-'}</span>
                )}
              </p>
            </div>

            <div className="info-block">
              <span className="info-label">Legislation</span>
              {loading ? (
                <p className="info-value">
                  <span className="placeholder col-10" aria-hidden="true"></span>
                </p>
              ) : (
                <a
                  target="_blank"
                  href={legislationLink(project)}
                  className="info-link"
                  rel="noreferrer"
                >
                  <p className="info-value hyperlink">{project?.legislation || '-'}</p>
                </a>
              )}
            </div>

            <hr className="divider" />

            <div className="info-block">
              <span className="info-label">Region</span>
              <p className="info-value">
                {loading ? (
                  <span className="placeholder col-6" aria-hidden="true"></span>
                ) : (
                  project?.region || '-'
                )}
              </p>
            </div>

            <div className="info-block">
              <span className="info-label">Location</span>
              <p className="info-value">
                {loading ? (
                  <span className="placeholder col-8" aria-hidden="true"></span>
                ) : (
                  project?.location || '-'
                )}
              </p>
            </div>

            <div className="map-wrapper">
              {loading ? (
                <div className="map-container">
                  <span className="placeholder w-100 h-100" aria-hidden="true" />
                </div>
              ) : centroid && project ? (
                <div className="map-container">
                  <Suspense
                    fallback={<span className="placeholder w-100 h-100" aria-hidden="true" />}
                  >
                    <DetailsMap project={project} />
                  </Suspense>
                </div>
              ) : (
                <div className="map-placeholder">
                  <span>No map available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
      >
        <i className="material-icons">{open ? 'keyboard_arrow_left' : 'keyboard_arrow_right'}</i>
      </button>
    </div>
  );
}
