/* eslint-disable react-refresh/only-export-components -- route pieces: a factory that returns the
   component a standard tab route takes, and the custom tab route's component. */
import type { ComponentType } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import { useExtendedPage, useProjectContext } from '../project-context';
import { ContentTab } from './content-tab';
import { contentTabFor, tabEntry } from './extended-page';
import type { StandardSegment } from './types';

/** Sends the visitor to Overview, keeping the query string and hash. */
function ToOverview({ basePath }: { basePath: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: `${basePath}/overview`, search, hash }} replace />;
}

/**
 * A standard tab route. On an extended project page it draws the page's content tab when one
 * takes the segment, and sends the visitor to Overview when the page's `tabs` leave the segment
 * out; otherwise, and on every other project, it draws `Standard`.
 */
export function standardTab(segment: StandardSegment, Standard: ComponentType) {
  return function StandardTabRoute() {
    const { project, basePath } = useProjectContext();
    const extended = useExtendedPage();
    const entry = contentTabFor(extended, segment);
    if (extended && entry) {
      return <ContentTab entry={entry} content={extended} project={project} basePath={basePath} />;
    }
    if (segment !== 'overview' && extended?.tabs && !tabEntry(extended, segment)) {
      return <ToOverview basePath={basePath} />;
    }
    return <Standard />;
  };
}

/**
 * A custom tab of an extended project page, e.g. `/p/:projId/act`. A segment the page has no tab
 * for, or any deeper path, on any project, goes to that project's Overview. Done here rather than
 * in a loader, which never sees the hash.
 */
export function ContentTabRoute() {
  const { segment = '', '*': rest = '' } = useParams();
  const { project, basePath } = useProjectContext();
  const extended = useExtendedPage();
  const entry = rest ? null : contentTabFor(extended, segment);
  if (!extended || !entry) return <ToOverview basePath={basePath} />;
  return (
    <ContentTab
      key={segment}
      entry={entry}
      content={extended}
      project={project}
      basePath={basePath}
    />
  );
}
