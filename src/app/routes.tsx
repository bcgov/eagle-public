import { redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { AppShell } from './layout/app-shell';
import { Home } from './pages/home/home';
import { About, type SectionId } from './pages/about';
import { SearchHelp } from './pages/search-help';
import { Projects } from './pages/projects/projects';
import { UnifiedSearch } from './pages/search/unified-search';
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
import { ContentTabRoute, standardTab } from './pages/project/extended/extended-route';
import { Comments } from './pages/comments/comments';
import {
  NotificationDocuments,
  NotificationPage,
} from './pages/project-notifications/notification-page';
import { legacySearchRedirect, resolveLegacySearch } from './routes/legacy-search';
import {
  COMMENT_PERIOD_SEGMENT,
  LEGACY_DOCUMENT_TABS,
  RENAMED_PROJECT_TABS,
} from './routes/project-segments';

/**
 * An Angular-era /search address means document search, and carries params the unified page does
 * not read. Rewrite it before the page renders; a new-style address returns null and renders as
 * it stands.
 */
export function searchLoader({ request }: LoaderFunctionArgs) {
  const next = resolveLegacySearch(request.url);
  return next ? redirect(`${next.pathname}${next.search}`) : null;
}

/** The four static pages became sections of /about; old links land on their section. */
function aboutSectionRedirect(section: SectionId) {
  return ({ request }: LoaderFunctionArgs) =>
    redirect(`/about${new URL(request.url).search}#${section}`);
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: Home },
      // The home page with one update open in its reader dialog.
      { path: 'updates/:id', Component: Home },

      { path: 'about', Component: About },
      { path: 'contact', loader: aboutSectionRedirect('contact') },

      { path: 'projects', Component: Projects },
      { path: 'projects-list', loader: legacySearchRedirect('projects') },

      { path: 'project-notifications', loader: legacySearchRedirect('notifications') },

      {
        path: 'pn/:projId/cp/:commentPeriodId',
        loader: ({ params }) =>
          redirect(`/pn/${params['projId']}/cp/${params['commentPeriodId']}/details`),
      },
      { path: 'pn/:projId/cp/:commentPeriodId/details', Component: Comments },

      // Project notification detail, on the project page shell. The comment period routes above
      // stay siblings, as the project ones do: the comments page is its own page, not a tab.
      {
        path: 'pn/:projId',
        Component: NotificationPage,
        children: [
          {
            index: true,
            loader: ({ params }) => redirect(`/pn/${params['projId']}/overview`),
          },
          { path: 'overview', Component: OverviewTab },
          { path: 'engagement', Component: EngagementTab },
          { path: 'documents', Component: NotificationDocuments },
        ],
      },

      { path: 'news', loader: legacySearchRedirect('activities') },

      { path: 'legislation', loader: aboutSectionRedirect('legislation') },
      { path: 'compliance-oversight', loader: aboutSectionRedirect('compliance') },
      { path: 'process', loader: aboutSectionRedirect('process') },

      { path: 'search', loader: searchLoader, Component: UnifiedSearch },

      // The content search page is now the documents tab's inside-documents scope.
      {
        path: 'search/content',
        loader: legacySearchRedirect('documents', { scope: 'inside' }),
      },

      { path: 'search-help', Component: SearchHelp },

      // Project comment period routes
      {
        path: `p/:projId/${COMMENT_PERIOD_SEGMENT}/:commentPeriodId`,
        loader: ({ params }) =>
          redirect(
            `/p/${params['projId']}/${COMMENT_PERIOD_SEGMENT}/${params['commentPeriodId']}/details`,
          ),
      },
      { path: `p/:projId/${COMMENT_PERIOD_SEGMENT}/:commentPeriodId/details`, Component: Comments },

      // Project detail routes with tabs
      {
        path: 'p/:projId',
        Component: ProjectPage,
        children: [
          {
            index: true,
            loader: ({ params }) => redirect(`/p/${params['projId']}/overview`),
          },
          { path: 'overview', Component: standardTab('overview', OverviewTab) },
          { path: 'updates', Component: standardTab('updates', UpdatesTab) },
          { path: 'engagement', Component: standardTab('engagement', EngagementTab) },
          {
            path: 'documents',
            Component: standardTab('documents', DocumentsPage),
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
          ...LEGACY_DOCUMENT_TABS.map((tab) => ({
            path: tab,
            loader: ({ params, request }: LoaderFunctionArgs) =>
              redirect(`/p/${params['projId']}/documents/${tab}${new URL(request.url).search}`),
          })),
          // Same for the two tabs the redesign renamed.
          ...RENAMED_PROJECT_TABS.map(({ from, to }) => ({
            path: from,
            loader: ({ params, request }: LoaderFunctionArgs) =>
              redirect(`/p/${params['projId']}/${to}${new URL(request.url).search}`),
          })),
          { path: 'decisions', Component: standardTab('decisions', DecisionsTab) },
          { path: 'compliance', Component: standardTab('compliance', ComplianceTab) },
          // An extended project page's own tabs. Every static path above outranks it; any other
          // path under the project goes to the project's Overview.
          { path: ':segment/*', Component: ContentTabRoute },
        ],
      },

      // Wildcard route
      { path: '*', loader: () => redirect('/') },
    ],
  },
];
