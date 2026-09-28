import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { listsQueryOptions } from 'app/api/api';
import { notificationQueryOptions } from 'app/api/notification';
import { DocumentsHeader } from 'app/pages/project/documents-page';
import { DocumentsTab } from 'app/pages/project/documents-tab';
import { ProjectShell } from 'app/pages/project/project';
import { useNotificationTabMeta } from 'app/pages/project/use-project-tab-meta';
import { searchUrl } from 'app/routes/legacy-search';

/** A project notification on the project page shell: overview, engagement and documents. */
export function NotificationPage() {
  const { projId = '' } = useParams();

  const { data: lists = [] } = useQuery(listsQueryOptions());

  const {
    data: project,
    isError,
    isPending,
    isSuccess,
  } = useQuery(notificationQueryOptions(projId));
  // Tab counts wait for the record, so a bad id does not fire their searches.
  const tabs = useNotificationTabMeta(isSuccess && project ? projId : '');

  if (isError) {
    return (
      <div className="container py-5">
        <h1>Could not load project notification</h1>
        <p>This project notification could not be loaded. Please try again.</p>
        <Link to={searchUrl('notifications')}>Back to all project notifications</Link>
      </div>
    );
  }

  return (
    <ProjectShell
      project={project ?? null}
      projId={projId}
      isNotification
      // Document views read type, milestone and phase names from the lists.
      lists={lists}
      tabs={tabs}
      isPending={isPending}
      notFound={isSuccess && !project}
    />
  );
}

/** A notification's documents: one list, without the project's document-type filter. */
export function NotificationDocuments() {
  return (
    <>
      <DocumentsHeader />
      <div className="documents-page__body">
        <DocumentsTab />
      </div>
    </>
  );
}
