import { Link } from 'react-router';
import { SubscribePopover } from 'app/components/subscribe-popover';
import type { Project } from 'app/models/project';
import './project-masthead.css';

interface ProjectMastheadProps {
  project: Project | null;
  projId: string;
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
}

/** Blue band at the top of every project tab: where you are, what the project is, how to follow it. */
export function ProjectMasthead({ project, projId, loading = false }: ProjectMastheadProps) {
  const subtitle = [project?.proponent?.name, project?.location].filter(Boolean).join(' · ');

  return (
    <div className="project-masthead" aria-busy={loading || undefined}>
      <div className="project-masthead__inner">
        <nav aria-label="Breadcrumb" className="project-masthead__breadcrumb">
          <ol>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/projects">Projects</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{project?.name}</li>
          </ol>
        </nav>

        <div className="project-masthead__row">
          <div className="project-masthead__titles">
            {loading && <span className="visually-hidden">Loading project</span>}
            <h1 className={`project-masthead__name${loading ? ' placeholder-wave' : ''}`}>
              {loading ? (
                <span className="placeholder col-9" aria-hidden="true"></span>
              ) : (
                project?.name || '-'
              )}
            </h1>
            {subtitle && <p className="project-masthead__meta">{subtitle}</p>}
          </div>

          <SubscribePopover serviceName={`project:${projId}`} variant="project" />
        </div>
      </div>
    </div>
  );
}
