import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadConfig } from 'app/config/config';
import { renderAt } from '../../../test-utils';
import { CommentPeriod } from 'app/models/commentperiod';
import { Project } from 'app/models/project';
import { OverviewTab } from './overview-tab';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('app/analytics/analytics', () => ({ track }));

const LISTS = [{ _id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018 }];

const PROJECT = new Project({
  _id: 'proj-1',
  name: 'Cedar Quarry',
  description: 'First line.\nSecond line.',
  legislation: '2002 Environmental Assessment Act',
  nature: 'New Construction',
  sector: 'Sand and Gravel',
  CEAAInvolvement: { name: 'Substituted' },
  CEAALink: 'https://iaac-aeic.gc.ca/050/evaluations',
  projectLead: 'Alex Lead',
  projectLeadEmail: 'alex.lead@gov.bc.ca',
  epicProjectID: 4321,
  dateAdded: '2026-01-05T00:00:00.000Z',
  dateUpdated: '2026-06-02T00:00:00.000Z',
});

const ACTIVITIES = [
  {
    _id: 'act-1',
    headline: 'Application accepted',
    dateAdded: '2026-06-01T00:00:00.000Z',
    content: '<p>The <strong>proponent</strong> submitted their application.</p>',
  },
  { _id: 'act-2', headline: 'Public comment period open', dateAdded: '2026-05-01T00:00:00.000Z' },
  { _id: 'act-3', headline: 'Process order issued', dateAdded: '2026-04-01T00:00:00.000Z' },
  { _id: 'act-4', headline: 'Readiness decision', dateAdded: '2026-03-01T00:00:00.000Z' },
];

const FEATURED = [
  {
    _id: 'doc-1',
    displayName: 'Featured Report',
    type: 'type-cert-2018',
    datePosted: '2026-05-01T00:00:00.000Z',
    internalSize: '2097152',
  },
];

const PINS = [{ _id: 'org-1', name: 'Cedar Nation', province: 'British Columbia' }];

let pinsTotal = 1;
let featuredTotal = 1;

/** A period whose window brackets today, so it counts as open and its banner is visible. */
function openPeriod(extra: Record<string, unknown> = {}) {
  const started = new Date();
  started.setDate(started.getDate() - 2);
  const completed = new Date();
  completed.setDate(completed.getDate() + 5);
  return new CommentPeriod({
    _id: 'cp-1',
    dateStarted: started.toISOString(),
    dateCompleted: completed.toISOString(),
    informationLabel: 'Draft Application',
    ...extra,
  });
}

let project: Project;
let requests: string[];

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({
      project,
      projId: 'proj-1',
      lists: LISTS,
      projectLoading: false,
    }),
  };
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderTab() {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('/pin')) {
        return jsonResponse([{ results: pinsTotal > 0 ? PINS : [], total_items: pinsTotal }]);
      }
      if (url.includes('dataset=RecentActivity')) {
        return jsonResponse([
          { searchResults: ACTIVITIES, meta: [{ searchResultsTotal: ACTIVITIES.length }] },
        ]);
      }
      if (url.includes('dataset=Document')) {
        return jsonResponse([
          {
            searchResults: featuredTotal > 0 ? FEATURED : [],
            meta: [{ searchResultsTotal: featuredTotal }],
          },
        ]);
      }
      return jsonResponse([{ searchResults: [], meta: [] }]);
    }),
  );

  return renderAt('/p/proj-1/overview', [
    { path: '/p/:projId/overview', Component: OverviewTab },
    { path: '/p/:projId/cp/:cpId/details', element: <div>comment period details</div> },
    { path: '/p/:projId/updates', element: <div>updates tab</div> },
  ]).router;
}

describe('overview tab', () => {
  beforeEach(() => {
    project = PROJECT;
    pinsTotal = 1;
    featuredTotal = 1;
    track.mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lists the project record under About this project', async () => {
    renderTab();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'About this project' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.overview-tab__description')?.innerHTML).toBe(
      'First line.<br>Second line.',
    );
    // The 2002 Act, not the 2018 default.
    expect(screen.getByRole('link', { name: /2002 Environmental Assessment Act/ })).toHaveAttribute(
      'href',
      'http://www.bclaws.ca/civix/document/id/complete/statreg/02043_01',
    );
    expect(screen.getByRole('link', { name: /Substituted/ })).toHaveAttribute(
      'href',
      'https://iaac-aeic.gc.ca/050/evaluations',
    );
    expect(screen.getByText('New Construction')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alex Lead' })).toHaveAttribute(
      'href',
      'mailto:alex.lead@gov.bc.ca',
    );
    expect(screen.getByText('4321')).toBeInTheDocument();
    expect(screen.getByText('January 5, 2026')).toBeInTheDocument();
    expect(screen.getByText('June 2, 2026')).toBeInTheDocument();
    expect(screen.getByText('Sand and Gravel')).toBeInTheDocument();
    // The panel above the tab owns these, so the tab must not repeat them.
    expect(screen.queryByText('Proponent')).not.toBeInTheDocument();
    expect(screen.queryByText('EA decision')).not.toBeInTheDocument();
  });

  it('counts the project documents in the About grid, linked to the Documents tab', async () => {
    renderTab();

    expect(await screen.findByRole('link', { name: '1 documents' })).toHaveAttribute(
      'href',
      '/p/proj-1/documents',
    );
  });

  it('offers the documents beside the comment period call to action', async () => {
    project = new Project({ ...PROJECT, commentPeriodForBanner: openPeriod() });
    renderTab();

    expect(await screen.findByRole('link', { name: 'Read the documents' })).toHaveAttribute(
      'href',
      '/p/proj-1/documents',
    );
  });

  it('invites email updates from the aside when eagle-notify is configured', async () => {
    window.__env = { logLevel: 4, NOTIFY_API: 'https://notify-api.example' };
    await loadConfig();
    renderTab();

    expect(await screen.findByText('Get these by email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe to updates' })).toBeInTheDocument();

    window.__env = { logLevel: 4, NOTIFY_API: '' };
    await loadConfig();
  });

  it('sends an in-EPIC comment period to its details page, and records the click', async () => {
    project = new Project({ ...PROJECT, commentPeriodForBanner: openPeriod() });
    const router = renderTab();

    expect(
      await screen.findByRole('heading', { name: 'Public comment period is Open' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft Application')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Share your thoughts' }));

    expect(track).toHaveBeenCalledWith('Comment Period Banner Clicked', {
      project_id: 'proj-1',
      project_name: 'Cedar Quarry',
      status: 'Open',
      is_met: false,
      destination: 'comment_period_details',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/cp/cp-1/details'));
  });

  it('sends an ENGAGE comment period out to its engagement page', async () => {
    project = new Project({
      ...PROJECT,
      commentPeriodForBanner: openPeriod({
        isMet: true,
        metURL: 'https://engage.gov.bc.ca/cedar',
        metBannerImageUrl: 'https://engage.gov.bc.ca/banner.jpg',
      }),
    });
    const open = vi.fn();
    const router = renderTab();
    vi.stubGlobal('open', open);

    await screen.findByRole('heading', { name: 'Public comment period is Open' });
    expect(document.querySelector('.overview-tab__callout-image')).toHaveAttribute(
      'src',
      'https://engage.gov.bc.ca/banner.jpg',
    );

    await userEvent.click(screen.getByRole('button', { name: /Share your thoughts/ }));

    expect(open).toHaveBeenCalledWith(
      'https://engage.gov.bc.ca/cedar',
      '_blank',
      'noopener,noreferrer',
    );
    expect(track).toHaveBeenCalledWith(
      'Comment Period Banner Clicked',
      expect.objectContaining({ is_met: true, destination: 'external_met' }),
    );
    expect(router.state.location.pathname).toBe('/p/proj-1/overview');
  });

  it('renders no callout image when metBannerImageUrl is an unsafe URL', async () => {
    project = new Project({
      ...PROJECT,
      commentPeriodForBanner: openPeriod({
        isMet: true,
        metURL: 'https://engage.gov.bc.ca/cedar',
        metBannerImageUrl: 'javascript:alert(1)',
      }),
    });
    renderTab();

    await screen.findByRole('heading', { name: 'Public comment period is Open' });
    expect(document.querySelector('.overview-tab__callout-image')).not.toBeInTheDocument();
  });

  it('shows no callout when the project has no comment period', async () => {
    renderTab();

    await screen.findByRole('heading', { level: 2, name: 'About this project' });
    expect(screen.queryByText(/Public comment period is/)).not.toBeInTheDocument();
  });

  it('shows the three most recent updates beside the project, and links to the rest', async () => {
    renderTab();

    expect(await screen.findByRole('link', { name: 'Application accepted' })).toHaveAttribute(
      'href',
      '/p/proj-1/updates',
    );
    expect(screen.getByText('Process order issued')).toBeInTheDocument();
    expect(screen.queryByText('Readiness decision')).not.toBeInTheDocument();
    // Total comes from the same RecentActivity page, so the count never needs its own request.
    expect(screen.getByRole('link', { name: 'See all 4' })).toHaveAttribute(
      'href',
      '/p/proj-1/updates',
    );
    // Summary strips markup to plain text; no dangerouslySetInnerHTML for this slot.
    expect(screen.getByText('The proponent submitted their application.')).toBeInTheDocument();
    // The Updates tab's own request, so the two tabs share one cached page.
    expect(requests.find((url) => url.includes('dataset=RecentActivity'))).toBe(
      '/api/search?dataset=RecentActivity&pageNum=0&pageSize=10&projectLegislation=default' +
        '&sortBy=-dateAdded&sortBy=&populate=true&and[project]=proj-1&fuzzy=false',
    );
  });

  it('lists featured documents with their type, date and size', async () => {
    renderTab();

    expect(await screen.findByRole('link', { name: 'Featured Report' })).toHaveAttribute(
      'href',
      '/api/public/document/doc-1/download/Featured%20Report',
    );
    expect(screen.getByText('Certificate Package · May 1, 2026 · 2.0 MB')).toBeInTheDocument();
  });

  it('gives each featured document its own download link and a documents-tab count', async () => {
    renderTab();

    await screen.findByRole('link', { name: 'Featured Report' });
    expect(screen.getByRole('link', { name: 'Download Featured Report' })).toHaveAttribute(
      'href',
      '/api/public/document/doc-1/download/Featured%20Report',
    );
    expect(screen.getByRole('link', { name: 'All 1 documents' })).toHaveAttribute(
      'href',
      '/p/proj-1/documents',
    );
  });

  it('asks for the five most recent featured documents', async () => {
    renderTab();

    await screen.findByText('Featured Report');
    expect(requests.find((url) => url.includes('isFeatured'))).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=5&projectLegislation=default' +
        '&sortBy=-datePosted&sortBy=&populate=false&and[isFeatured]=true&fuzzy=false',
    );
  });

  it('hides the featured documents card when the project has none', async () => {
    featuredTotal = 0;
    renderTab();

    await waitFor(() => expect(requests.some((url) => url.includes('isFeatured'))).toBe(true));
    await waitFor(() => expect(screen.queryByText('Featured documents')).not.toBeInTheDocument());
  });

  it('lists the participating nations under their card heading', async () => {
    renderTab();

    expect(
      screen.getByRole('heading', { name: 'Participating Indigenous Nations' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Cedar Nation')).toBeInTheDocument();
    expect(screen.getByText('British Columbia')).toBeInTheDocument();
    expect(requests.find((url) => url.includes('/pin'))).toBe(
      '/api/project/proj-1/pin?pageNum=0&pageSize=100&sortBy=+name',
    );
  });

  it('hides the participating nations card when the project has none', async () => {
    pinsTotal = 0;
    renderTab();

    await waitFor(() => expect(requests.some((url) => url.includes('/pin'))).toBe(true));
    await waitFor(() =>
      expect(screen.queryByText('Participating Indigenous Nations')).not.toBeInTheDocument(),
    );
  });
});
