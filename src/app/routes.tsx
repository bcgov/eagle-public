import { redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { AppShell } from './layout/app-shell';
import { Home } from './pages/home';
import { Contact } from './pages/contact';
import { Legislation } from './pages/legislation';
import { Process } from './pages/process';
import { ComplianceOversight } from './pages/compliance-oversight';
import { SearchHelp } from './pages/search-help';
import { ProjectList } from './pages/project-list/project-list';
import { Projects } from './pages/projects/projects';
import { News } from './pages/news';
import { ProjectNotifications } from './pages/project-notifications/project-notifications';
import { Search } from './pages/search/search';
import { ContentSearch } from './pages/search/content-search';
import { ProjectPage } from './pages/project/project';
import { ProjectDetailsTab } from './pages/project/project-details-tab';
import { Certificates } from './pages/project/certificates';
import { Amendments } from './pages/project/amendments';
import { Application } from './pages/project/application';
import { CommentingTab } from './pages/project/commenting-tab';
import { DocumentsPage } from './pages/project/documents-page';
import { DocumentsTab } from './pages/project/documents-tab';
import { ComplianceDocumentsTab } from './pages/project/compliance-documents-tab';
import { DecisionsTab } from './pages/project/decisions-tab';
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

      { path: 'projects', Component: Projects },
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

      { path: 'search', Component: Search },

      // Its own component, not the table-driven one: content results are a list of documents with
      // the matched text, which a table layout cannot render.
      {
        path: 'search/content',
        loader: contentSearchLoader,
        Component: ContentSearch
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
        Component: ProjectPage,
        children: [
          { index: true, loader: ({ params }) => redirect(`/p/${params['projId']}/project-details`) },
          { path: 'project-details', Component: ProjectDetailsTab },
          { path: 'commenting', Component: CommentingTab },
          {
            path: 'documents',
            Component: DocumentsPage,
            children: [
              { index: true, Component: DocumentsTab },
              { path: 'application', Component: Application },
              { path: 'certificates', Component: Certificates },
              { path: 'amendments', Component: Amendments },
              { path: 'compliance', Component: ComplianceDocumentsTab }
            ]
          },
          // The document-type tabs used to sit at the top level. Keep the old paths pointing at
          // their sub-tab, filters and paging intact, so published links still work.
          ...['application', 'certificates', 'amendments'].map(tab => ({
            path: tab,
            loader: ({ params, request }: LoaderFunctionArgs) =>
              redirect(`/p/${params['projId']}/documents/${tab}${new URL(request.url).search}`)
          })),
          { path: 'decisions', Component: DecisionsTab }
        ]
      },

      // Wildcard route
      { path: '*', loader: () => redirect('/') }
    ]
  }
];
