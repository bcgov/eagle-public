import { redirect, type RouteObject } from 'react-router';
import { AppShell } from './layout/app-shell';
import { Home } from './pages/home';
import { Contact } from './pages/contact';
import { Legislation } from './pages/legislation';
import { Process } from './pages/process';
import { ComplianceOversight } from './pages/compliance-oversight';
import { SearchHelp } from './pages/search-help';
import { Placeholder } from './pages/placeholder';
import { ProjectList } from './pages/project-list/project-list';
import { News } from './pages/news';
import { ProjectNotifications } from './pages/project-notifications/project-notifications';
import { Comments } from './pages/comments/comments';
import { CacUnsubscribe } from './pages/cac-unsubscribe';
import { contentSearchEnabled } from './config/config';

/**
 * Content search is served by the API in every environment, but the UI is offered only where the
 * CONTENT_SEARCH config flag says so. Redirects rather than falling through, so a bookmarked or
 * shared link lands on document search instead of the home page.
 */
export function contentSearchLoader() {
  if (!contentSearchEnabled()) {
    throw redirect('/search');
  }
  return null;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: Home },

      { path: 'contact', Component: Contact },

      { path: 'cac-unsubscribe', Component: CacUnsubscribe },
      // The unsubscribe link eagle-api mails out carries Angular matrix parameters
      // (`/cac-unsubscribe;project=…;email=…`), which react-router sees as one path segment.
      {
        path: ':cacUnsubscribe',
        loader: ({ params }) => (params['cacUnsubscribe']?.startsWith('cac-unsubscribe;') ? null : redirect('/')),
        Component: CacUnsubscribe
      },

      { path: 'projects', element: <Placeholder name="Projects" /> },
      { path: 'projects-list', Component: ProjectList },

      { path: 'project-notifications', Component: ProjectNotifications },

      {
        path: 'pn/:projId/cp/:commentPeriodId',
        loader: ({ params }) => redirect(`/pn/${params['projId']}/cp/${params['commentPeriodId']}/details`)
      },
      { path: 'pn/:projId/cp/:commentPeriodId/details', Component: Comments },

      { path: 'news', Component: News },

      { path: 'legislation', Component: Legislation },

      { path: 'compliance-oversight', Component: ComplianceOversight },

      { path: 'process', Component: Process },

      { path: 'search', element: <Placeholder name="Search" /> },

      // Its own component, not the table-driven one: content results are a list of documents with
      // the matched text, which a table layout cannot render.
      {
        path: 'search/content',
        loader: contentSearchLoader,
        element: <Placeholder name="Content Search" />
      },

      { path: 'search-help', Component: SearchHelp },

      // Project comment period routes
      {
        path: 'p/:projId/cp/:commentPeriodId',
        loader: ({ params }) => redirect(`/p/${params['projId']}/cp/${params['commentPeriodId']}/details`)
      },
      { path: 'p/:projId/cp/:commentPeriodId/details', Component: Comments },

      // Project detail routes with tabs
      {
        path: 'p/:projId',
        element: <Placeholder name="Project" withOutlet />,
        children: [
          { index: true, loader: ({ params }) => redirect(`/p/${params['projId']}/project-details`) },
          { path: 'project-details', element: <Placeholder name="Project Details" /> },
          { path: 'certificates', element: <Placeholder name="Certificates" /> },
          { path: 'amendments', element: <Placeholder name="Amendments" /> },
          { path: 'application', element: <Placeholder name="Application" /> },
          { path: 'commenting', element: <Placeholder name="Commenting" /> },
          { path: 'documents', element: <Placeholder name="Documents" /> },
          { path: 'decisions', element: <Placeholder name="Decisions" /> }
        ]
      },

      // Wildcard route
      { path: '*', loader: () => redirect('/') }
    ]
  }
];
