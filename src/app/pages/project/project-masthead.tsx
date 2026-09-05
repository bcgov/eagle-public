import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { showToast } from 'app/state/toast';
import { Skeleton } from 'app/components/skeleton/skeleton';
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

  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  // TODO: use the project's real short link once demi-api exposes a public /s/<code> lookup
  // (PUBLIC-145); staff create the codes in DEMI Admin.
  async function copyLink(): Promise<void> {
    const url = `${window.location.origin}/p/${projId}`;
    try {
      await navigator.clipboard.writeText(url);
      clearTimeout(copyTimeoutRef.current);
      setCopyState('copied');
      copyTimeoutRef.current = setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      // No clipboard (insecure origin, or the reader refused it): show the link to copy by hand.
      showToast(`Copy this link: ${url}`, { type: 'info', duration: 8000 });
    }
  }

  return (
    <div className="project-masthead" aria-busy={loading || undefined}>
      <div className="project-masthead__inner">
        <nav aria-label="Breadcrumb" className="project-masthead__breadcrumb">
          <ol>
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
            <h1 className="project-masthead__name">
              {loading ? <Skeleton width="60%" /> : project?.name}
            </h1>
            {loading ? (
              <p className="project-masthead__meta">
                <Skeleton width="35%" />
              </p>
            ) : (
              subtitle && <p className="project-masthead__meta">{subtitle}</p>
            )}
          </div>

          <div className="project-masthead__actions">
            <SubscribePopover
              serviceName={`project:${projId}`}
              variant="project"
              surface="masthead"
            />
            <button
              type="button"
              className={
                copyState === 'copied'
                  ? 'project-masthead__action project-masthead__action--link project-masthead__action--copied'
                  : 'project-masthead__action project-masthead__action--link'
              }
              onClick={copyLink}
            >
              <i className="material-icons" aria-hidden="true">
                {copyState === 'copied' ? 'check' : 'link'}
              </i>
              {copyState === 'copied' ? 'Copied' : 'Short link'}
            </button>
            {/* Sibling, not nested in the button: a live region inside it would fold into the
                button's accessible name instead of announcing as its own update. */}
            <span role="status" className="visually-hidden">
              {copyState === 'copied' ? 'Link copied to clipboard' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
