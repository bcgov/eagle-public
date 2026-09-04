import { useEffect, useState } from 'react';
import { Link } from 'react-router';
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

/** How long the Short link button reads "Link copied" before going back. */
const COPIED_MS = 2000;

/** Blue band at the top of every project tab: where you are, what the project is, how to follow it. */
export function ProjectMasthead({ project, projId, loading = false }: ProjectMastheadProps) {
  const subtitle = [project?.proponent?.name, project?.location].filter(Boolean).join(' · ');
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState('');

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  // TODO: use the project's real short link once demi-api exposes a public /s/<code> lookup
  // (PUBLIC-145); staff create the codes in DEMI Admin.
  async function copyLink(): Promise<void> {
    const url = `${window.location.origin}/p/${projId}`;
    try {
      await navigator.clipboard.writeText(url);
      setFallback('');
      setCopied(true);
    } catch {
      // No clipboard (insecure origin, or the reader refused it): show the link to copy by hand.
      setCopied(false);
      setFallback(url);
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
              className="project-masthead__action project-masthead__action--link"
              onClick={copyLink}
            >
              <i className="material-icons" aria-hidden="true">
                link
              </i>
              {copied ? 'Link copied' : 'Short link'}
            </button>
            {/* The button label carries the success, so only the copy-by-hand fallback is shown. */}
            <p
              className={`project-masthead__copy-status${fallback ? '' : ' visually-hidden'}`}
              role="status"
              aria-live="polite"
            >
              {copied ? 'Link copied to clipboard' : fallback && `Copy this link: ${fallback}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
