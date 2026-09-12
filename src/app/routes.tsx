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
import { OverviewTab } from './pages/project/overview-tab';
import { UpdatesTab } from './pages/project/updates-tab';
import { EngagementTab } from './pages/project/engagement-tab';
import { ComplianceTab } from './pages/project/compliance-tab';
import { Certificates } from './pages/project/certificates';
import { Amendments } from './pages/project/amendments';
import { Application } from './pages/project/application';
import { ManagementPlans } from './pages/project/management-plans';
import { DocumentsPage } from './pages/project/documents-page';
import { DocumentsTab } from './pages/project/documents-tab';
import { ComplianceDocumentsTab } from './pages/project/compliance-documents-tab';
import { DecisionsTab } from './pages/project/decisions-tab';
import { Comments } from './pages/comments/comments';
import { legacySearchRedirect } from './routes/legacy-search';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: Home },

      { path: 'contact', Component: Contact },

      { path: 'projects', Component: Projects },
      {
        path: 'projects-list',
        loader: legacySearchRedirect('projects'),
        Component: ProjectList,
      },

      {
        path: 'project-notifications',
        loader: legacySearchRedirect('notifications'),
        Component: ProjectNotifications,
      },

      {
        path: 'pn/:projId/cp/:commentPeriodId',
        loader: ({ params }) =>
          redirect(`/pn/${params['projId']}/cp/${params['commentPeriodId']}/details`),
      },
      { path: 'pn/:projId/cp/:commentPeriodId/details', Component: Comments },

      { path: 'news', loader: legacySearchRedirect('activities'), Component: News },

      { path: 'legislation', Component: Legislation },

      { path: 'compliance-oversight', Component: ComplianceOversight },

      { path: 'process', Component: Process },

      { path: 'search', Component: Search },

      // Content search folds into the documents tab as the "inside" scope. The component stays
      // mounted until that tab lands; the loader means nothing reaches it.
      {
        path: 'search/content',
        loader: legacySearchRedirect('documents', { scope: 'inside' }),
        Component: ContentSearch,
      },

      { path: 'search-help', Component: SearchHelp },

      // Project comment period routes
      {
        path: 'p/:projId/cp/:commentPeriodId',
        loader: ({ params }) =>
          redirect(`/p/${params['projId']}/cp/${params['commentPeriodId']}/details`),
      },
      { path: 'p/:projId/cp/:commentPeriodId/details', Component: Comments },

      // Project detail routes with tabs
      {
        path: 'p/:projId',
        Component: ProjectPage,
        children: [
          {
            index: true,
            loader: ({ params }) => redirect(`/p/${params['projId']}/overview`),
          },
          { path: 'overview', Component: OverviewTab },
          { path: 'updates', Component: UpdatesTab },
          { path: 'engagement', Component: EngagementTab },
          {
            path: 'documents',
            Component: DocumentsPage,
            children: [
              { index: true, Component: DocumentsTab },
              { path: 'application', Component: Application },
              { path: 'certificates', Component: Certificates },
              { path: 'amendments', Component: Amendments },
              { path: 'compliance', Component: ComplianceDocumentsTab },
              { path: 'management-plans', Component: ManagementPlans },
            ],
          },
          // The document-type tabs used to sit at the top level. Keep the old paths pointing at
          // their sub-tab, filters and paging intact, so published links still work.
          ...['application', 'certificates', 'amendments'].map((tab) => ({
            path: tab,
            loader: ({ params, request }: LoaderFunctionArgs) =>
              redirect(`/p/${params['projId']}/documents/${tab}${new URL(request.url).search}`),
          })),
          // Same for the two tabs the redesign renamed.
          ...[
            { from: 'project-details', to: 'overview' },
            { from: 'commenting', to: 'engagement' },
          ].map(({ from, to }) => ({
            path: from,
            loader: ({ params, request }: LoaderFunctionArgs) =>
              redirect(`/p/${params['projId']}/${to}${new URL(request.url).search}`),
          })),
          { path: 'decisions', Component: DecisionsTab },
          { path: 'compliance', Component: ComplianceTab },
        ],
      },

      // Wildcard route
      { path: '*', loader: () => redirect('/') },
    ],
  },
];
