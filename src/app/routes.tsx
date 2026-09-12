import { redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { AppShell } from './layout/app-shell';
import { Home } from './pages/home';
import { Contact } from './pages/contact';
import { Legislation } from './pages/legislation';
import { Process } from './pages/process';
import { ComplianceOversight } from './pages/compliance-oversight';
import { SearchHelp } from './pages/search-help';
import { Projects } from './pages/projects/projects';
import { News } from './pages/news';
import { ProjectNotifications } from './pages/project-notifications/project-notifications';
import { UnifiedSearch } from './pages/search/unified-search';
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
import { contentSearchEnabled } from './config/config';
import { legacySearchRedirect, resolveLegacySearch } from './routes/legacy-search';

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

/**
 * An Angular-era /search address means document search, and carries params the unified page does
 * not read. Rewrite it before the page renders; a new-style address returns null and renders as
 * it stands.
 */
export function searchLoader({ request }: LoaderFunctionArgs) {
  const next = resolveLegacySearch(request.url);
  return next ? redirect(`${next.pathname}${next.search}`) : null;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: Home },

      { path: 'contact', Component: Contact },

      { path: 'projects', Component: Projects },
      { path: 'projects-list', loader: legacySearchRedirect('projects') },

      { path: 'project-notifications', Component: ProjectNotifications },

      {
        path: 'pn/:projId/cp/:commentPeriodId',
        loader: ({ params }) =>
          redirect(`/pn/${params['projId']}/cp/${params['commentPeriodId']}/details`),
      },
      { path: 'pn/:projId/cp/:commentPeriodId/details', Component: Comments },

      { path: 'news', Component: News },

      { path: 'legislation', Component: Legislation },

      { path: 'compliance-oversight', Component: ComplianceOversight },

      { path: 'process', Component: Process },

      { path: 'search', loader: searchLoader, Component: UnifiedSearch },

      // Its own component, not the table-driven one: content results are a list of documents with
      // the matched text, which a table layout cannot render.
      {
        path: 'search/content',
        loader: contentSearchLoader,
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
