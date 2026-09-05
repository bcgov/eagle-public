import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { showToast } from 'app/state/toast';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { useDemiProject } from 'app/api/project-phases';
import { isSafeUrl } from 'app/utils/safe-url';
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

  const demiShortUrl = useDemiProject(projId).data?.shortUrl;

  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  // ponytail: execCommand is deprecated but still the only copy path on http LAN origins
  // (navigator.clipboard needs a secure context); drop it once those origins move to https.
  function copyWithExecCommand(text: string): boolean {
    if (typeof document.execCommand !== 'function') {
      return false;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
  }

  async function copyLink(): Promise<void> {
    const url = isSafeUrl(demiShortUrl) ? demiShortUrl : `${window.location.origin}/p/${projId}`;
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      copied = copyWithExecCommand(url);
    }
    if (copied) {
      clearTimeout(copyTimeoutRef.current);
      setCopyState('copied');
      copyTimeoutRef.current = setTimeout(() => setCopyState('idle'), 2000);
    } else {
      // Both copy paths failed: show the link to copy by hand.
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
              <span className="project-masthead__action-label">
                {copyState === 'copied' ? 'Copied' : 'Short link'}
              </span>
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
