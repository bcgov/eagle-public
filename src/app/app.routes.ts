import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { StaticPageComponent, StaticPageData } from './static-page/static-page.component';
import { SearchHelpComponent } from './search-help/search-help.component';
import { CACUnsubscribeComponent } from './cac-unsubscribe/cac-unsubscribe.component';
import { CommentsComponent } from './comments/comments.component';
import { SearchWrapperComponent } from './search/search-wrapper.component';
import { ProjectsComponent } from './projects/projects.component';
import { ProjectComponent } from './project/project';
import { ProjectDetailsTabComponent } from './project/project-details-tab/project-details-tab.component';
import { CertificatesComponent } from './project/certificates/certificates.component';
import { AmendmentsComponent } from './project/amendments/amendments.component';
import { ApplicationComponent } from './project/application/application.component';
import { CommentingTabComponent } from './project/commenting-tab/commenting-tab.component';
import { DocumentsTabComponent } from './project/documents/documents-tab.component';
import { DecisionsTabComponent } from './project/decisions-tab/decisions-tab.component';

const contactData: StaticPageData = {
  heroBannerTitle: 'Connect With Us',
  heroBannerDescription: 'This website aims to improve transparency of the provincial environmental assessment process, and to provide citizens and stakeholders with access to project data and information. If you are interested in providing us with feedback about your experience using this website, please feel free to send us your feedback.',
  heroBannerActions: [
    {
      label: 'Submit your Feedback',
      href: 'mailto:EAO.EPICsystem@gov.bc.ca',
      icon: 'email',
      title: 'Submit your feedback to the Environmental Assessment Office'
    }
  ],
  infoCards: [
    {
      title: 'B.C. Environmental Assessment Office',
      description: 'Please use the <a href="https://dir.gov.bc.ca/gtds.cgi?show=Branch&organizationCode=ENV&organizationalUnitCode=ENVIRON5" target="_blank" rel="noopener">B.C. EAO Government Directory</a> listing to find contact information for specific Environmental Assessment Office staff.',
      icon: 'phone',
      button: {
        text: 'Visit EAO B.C. Government Directory',
        href: 'https://dir.gov.bc.ca/gtds.cgi?show=Branch&organizationCode=ENV&organizationalUnitCode=ENVIRON5',
        target: '_blank',
        rel: 'noopener',
        title: 'Go to the EAO B.C. Government Directory'
      }
    },
    {
      title: 'Compliance Oversight',
      description: 'For questions about compliance, or if you have information about possible non-compliance with an environmental assessment certificate, please email <a href="mailto:eao.compliance@gov.bc.ca">eao.compliance@gov.bc.ca</a>.',
      icon: 'email',
      button: {
        text: 'Email EAO Compliance',
        href: 'mailto:eao.compliance@gov.bc.ca',
        title: 'Email us your questions about compliance oversight'
      }
    },
    {
      title: 'Report Natural Resource Violations',
      description: 'If you have seen misconduct involving wildlife, ecosystems, heritage sites or natural resources, you can report it at this <a href="http://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/natural-resource-law-enforcement/report-natural-resource-violations" target="_blank" rel="noopener">link here</a>.',
      icon: 'report_problem',
      button: {
        text: 'Report a Natural Resource Violation',
        href: 'http://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/natural-resource-law-enforcement/report-natural-resource-violations',
        target: '_blank',
        rel: 'noopener',
        title: 'Report a Natural Resource Violation'
      }
    }
  ]
};

const legislationData: StaticPageData = {
  heroBannerTitle: 'Legislation',
  heroBannerDescription: 'Learn about the legislation and regulations that apply to environmental assessments in the province of British Columbia.',
  heroBannerActions: [
    {
      label: '2002 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=1D2FF7DF6672482A84705D2519574C27',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    },
    {
      label: '2018 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=B5737A3A620146219ABED73B5066DEC6',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    }
  ],
  bodyHtml: `
    <p>The Environmental Assessment Act and associated regulations set a clear path for environmental assessment in British Columbia, a process that is undertaken by the Environmental Assessment Office.</p>
    <p>On December 16th, 2019, the new Environmental Assessment Act (2018) came into force. Many projects with an environmental assessment already underway will continue under the old Act (2002) process, while any new projects after December 16th, 2019 will undergo an environmental assessment under the new Act (2018) process. Each process has its own unique regulation and agreements.</p>
  `
};

const processData: StaticPageData = {
  heroBannerTitle: 'Process & Procedures',
  heroBannerDescription: 'Learn more about how the Environmental Assessment Office neutrally administers a process that is predictable, transparent, timely, procedurally fair, and holds all participants accountable.',
  heroBannerActions: [
    {
      label: '2002 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=AF29E35F5F9F4ACE91BF59F5FA25BF54',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    },
    {
      label: '2018 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=E0DC041CBB194136A0C14B8A2F829A16',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    }
  ],
  bodyHtml: `
    <p>On December 16th, 2019, the new Environmental Assessment Act (2018) came in to force. Many projects with an environmental assessment already underway will continue under the old Act (2002) process, while any new projects after December 16th, 2019 will undergo an environmental assessment under the new Act (2018) process.</p>
  `
};

const complianceData: StaticPageData = {
  heroBannerTitle: 'Compliance Oversight',
  heroBannerDescription: 'Learn about how we collaborate with other government agencies to coordinate oversight of projects that have successfully completed an environmental assessment.',
  heroBannerActions: [
    {
      label: 'View Compliance & Enforcement Policies and Procedures',
      href: 'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/environmental-assessments/compliance-and-enforcement',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View compliance and enforcement policies and procedures'
    }
  ],
  bodyHtml: `
    <p>The Environmental Assessment Office's work doesn't end when a project receives an Environmental Assessment Certificate.</p>
    <p>Compliance and enforcement is an important part of the Environmental Assessment process, and helps ensure certificate holders are following the conditions designed to minimize the potential for adverse effects from a project on environmental, cultural, health, social, and economic values.</p>
    <p>The Environmental Assessment Office works with the other provincial government agencies to oversee projects that have successfully completed an environmental assessment.</p>
  `
};

export const routes: Routes = [
  {
    path: 'contact',
    component: StaticPageComponent,
    data: contactData
  },
  
  {
    path: 'cac-unsubscribe',
    component: CACUnsubscribeComponent
  },
  
  {
    path: 'projects',
    component: ProjectsComponent
  },
  {
    path: 'projects-list',
    redirectTo: '/search?tab=projects',
    pathMatch: 'full'
  },
  
  {
    path: 'project-notifications',
    redirectTo: '/search?tab=notifications',
    pathMatch: 'full'
  },
  
  {
    path: 'pn/:projId/cp/:commentPeriodId',
    redirectTo: 'pn/:projId/cp/:commentPeriodId/details',
    pathMatch: 'full'
  },
  {
    path: 'pn/:projId/cp/:commentPeriodId/details',
    component: CommentsComponent
  },
  
  {
    path: 'news',
    redirectTo: '/search?tab=updates',
    pathMatch: 'full'
  },
  
  {
    path: 'legislation',
    component: StaticPageComponent,
    data: legislationData
  },
  
  {
    path: 'compliance-oversight',
    component: StaticPageComponent,
    data: complianceData
  },
  
  {
    path: 'process',
    component: StaticPageComponent,
    data: processData
  },
  
  {
    path: 'search',
    component: SearchWrapperComponent
  },
  
  {
    path: 'search-help',
    component: SearchHelpComponent
  },
  
  // Project comment period routes
  {
    path: 'p/:projId/cp/:commentPeriodId',
    redirectTo: 'p/:projId/cp/:commentPeriodId/details',
    pathMatch: 'full'
  },
  {
    path: 'p/:projId/cp/:commentPeriodId/details',
    component: CommentsComponent
  },
  
  // Project detail routes with tabs
  {
    path: 'p/:projId',
    component: ProjectComponent,
    children: [
      {
        path: '',
        redirectTo: 'project-details',
        pathMatch: 'full'
      },
      {
        path: 'project-details',
        component: ProjectDetailsTabComponent
      },
      {
        path: 'certificates',
        component: CertificatesComponent
      },
      {
        path: 'amendments',
        component: AmendmentsComponent
      },
      {
        path: 'application',
        component: ApplicationComponent
      },
      {
        path: 'commenting',
        component: CommentingTabComponent
      },
      {
        path: 'documents',
        component: DocumentsTabComponent
      },
      {
        path: 'decisions',
        component: DecisionsTabComponent
      }
    ]
  },
  
  {
    path: '',
    component: HomeComponent
  },
  
  // Wildcard route
  {
    path: '**',
    redirectTo: '/',
    pathMatch: 'full'
  }
];
