import { useEffect, useRef, useState } from 'react';
import { showToast } from 'app/state/toast';
import { PageMasthead } from 'app/layout/page-masthead';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { useDemiProject } from 'app/api/project-phases';
import { searchUrl } from 'app/routes/legacy-search';
import { isSafeUrl } from 'app/utils/safe-url';
import type { Project } from 'app/models/project';
import './project-masthead.css';

interface ProjectMastheadProps {
  project: Project | null;
  projId: string;
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
}

/** The shared band, filled in for a project: what it is, and how to follow or share it. */
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
    <PageMasthead
      className="project-masthead"
      busy={loading}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Search', to: searchUrl('projects') },
        { label: project?.name ?? '' },
      ]}
      title={
        loading ? (
          <>
            <span className="visually-hidden">Loading project</span>
            <Skeleton width="60%" />
          </>
        ) : (
          project?.name
        )
      }
      meta={loading ? <Skeleton width="35%" /> : subtitle || undefined}
      actions={
        <>
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
        </>
      }
    />
  );
}
