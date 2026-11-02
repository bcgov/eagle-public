import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import { explorerLink } from 'app/pages/projects/explorer-link';
import './project-location-map.css';

// maplibre-gl is ~1 MB; keep it and its wrapper out of the main bundle until this map renders.
const DetailsMap = lazy(() => import('./details-map').then((m) => ({ default: m.DetailsMap })));

interface ProjectLocationMapProps {
  project: Project | null;
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
  /** A project notification: the explorer lists projects only, so it gets no explorer link. */
  notification?: boolean;
}

/** "Open in map explorer", selecting the project; the plain explorer while it is still null. */
export function MapExplorerLink({ project }: { project: Project | null }) {
  return (
    <Link className="project-location-map__link" to={explorerLink(project)}>
      <span className="link-label">Open in map explorer</span>
      <span className="material-icons" aria-hidden="true">
        arrow_forward
      </span>
    </Link>
  );
}

/** The project pinned at its centroid, with a link into the map explorer. Fills its container. */
export function ProjectLocationMap({
  project,
  loading = false,
  notification = false,
}: ProjectLocationMapProps) {
  const centroid = project?.centroid?.length === 2 ? project.centroid : null;

  return (
    <div className="project-location-map">
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
          {!notification && <MapExplorerLink project={project} />}
        </>
      ) : (
        <div className="map-placeholder">
          <span>No map available</span>
        </div>
      )}
    </div>
  );
}
