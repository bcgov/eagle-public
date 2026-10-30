import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import { queryClient } from 'app/api/query-client';
import { loadConfig } from 'app/config/config';
import { Project } from 'app/models/project';
import { json, native } from '../home/home-fetch.spec-helper';
import { renderAt } from '../../../test-utils';
import { ProjectSummary } from './project-summary';
import { CEDAR, TODAY, TRANSITIONED, work } from './timeline.fixture';

const DEMI = '/demi-projects';
const ACT_2002 = '2002 Environmental Assessment Act';
const EAA_2002 = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/02043_01';
const EAA_2018 = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/18051';

/** CEDAR in a second assessment: Track work 900 is an active work of type 6 (assessment). */
function caseA(processPlanningEnd = '2026-12-15T00:00:00.000Z'): DemiProject {
  return {
    ...CEDAR,
    eagleId: 'cedar',
    id: 7,
    projectType: 'Energy-Petroleum & Natural Gas',
    projectSubType: 'LNG Facility',
    activeWork: { trackWorkId: 900, workType: 'Assessment', eaAct: CEDAR.legislation },
    works: [
      ...(CEDAR.works as unknown[]),
      work({
        trackWorkId: 900,
        workTypeId: 6,
        workType: 'Assessment',
        isActive: true,
        workState: 'IN_PROGRESS',
        phases: [
          {
            name: 'Early Engagement',
            startDate: '2019-12-02T00:00:00.000Z',
            endDate: '2020-06-01T00:00:00.000Z',
            isCompleted: true,
          },
          {
            name: 'Process Planning',
            startDate: '2026-09-01T00:00:00.000Z',
            endDate: processPlanningEnd,
            isCompleted: false,
          },
          { name: 'Application Development & Review', isCompleted: false },
        ],
      }),
    ],
    // Midnight UTC, which a Pacific `longDate` would show as December 1.
    assessments: [
      { phases: [{ name: 'Early Engagement', startDate: '2019-12-02T00:00:00.000Z' }] },
    ],
  } as DemiProject;
}

/** Cariboo Gold's 2018 assessment: Track granted it, Eagle still says "In Progress". */
const GRANTED_ASSESSMENT = work({
  workTypeId: 6,
  workType: 'Assessment',
  workState: 'COMPLETED',
  outcome: 'Environmental Assessment Certificate GRANTED',
  decisionDate: '2023-10-10T00:00:00.000Z',
});

/** A project in notification: active Track work of type 1, so the heading is the Eagle phase. */
const NOTIFIED: DemiProject = {
  ...TRANSITIONED,
  eagleId: 'notified',
  id: 46,
  projectType: 'Mines',
  projectSubType: 'Gold',
  activeWork: { trackWorkId: 902, workType: 'Project Notification' },
  works: [
    work({
      trackWorkId: 902,
      workTypeId: 1,
      workType: 'Project Notification',
      isActive: true,
      workState: 'IN_PROGRESS',
      phases: [
        {
          name: 'Notification Review',
          startDate: '2026-08-04T00:00:00.000Z',
          endDate: '2026-12-01T00:00:00.000Z',
          isCompleted: false,
        },
      ],
    }),
  ],
  assessments: [{ phases: [{ name: 'Pre-Application', startDate: '2008-11-15T08:00:00.000Z' }] }],
} as DemiProject;

/** Cariboo Gold: certified in Track, now in an amendment (Type 04). */
const CARIBOO: DemiProject = {
  ...TRANSITIONED,
  eagleId: 'cariboo',
  id: 45,
  projectType: 'Mines',
  projectSubType: 'Gold',
  activeWork: { trackWorkId: 901, workType: 'Amendment' },
  works: [
    GRANTED_ASSESSMENT,
    work({
      trackWorkId: 901,
      workTypeId: 7,
      workType: 'Amendment',
      isActive: true,
      workState: 'IN_PROGRESS',
      phases: [
        {
          name: 'Amendment Review',
          startDate: '2026-08-04T00:00:00.000Z',
          endDate: '2026-12-01T00:00:00.000Z',
          isCompleted: false,
        },
      ],
    }),
  ],
  assessments: [{ phases: [{ name: 'Pre-Application', startDate: '2008-11-15T08:00:00.000Z' }] }],
} as DemiProject;

/** Site C: 2002 Act only, no Track work, a sector in place of a sub-type. */
const SITE_C: DemiProject = {
  eagleId: 'site-c',
  id: 88,
  name: 'Site C Clean Energy Project',
  legislation: ACT_2002,
  legislationYearList: [2002],
  currentLegislationYear: 'legislation_2002',
  projectType: 'Energy-Electricity',
  sector: 'Hydroelectric',
  currentPhaseName: { _id: 'ph-2002', name: 'Post Decision - Construction' },
  eacDecision: { _id: 'dec-2002', name: 'Certificate Issued' },
  decisionDate: '2014-10-14T07:00:00.000Z',
  activeWork: null,
  assessments: [{ phases: [{ name: 'Pre-Application', startDate: '2011-08-01T07:00:00.000Z' }] }],
} as DemiProject;

/** A 2002 project the proponent withdrew; Track has it as Closed. */
const WITHDRAWN: DemiProject = {
  ...SITE_C,
  eagleId: 'withdrawn',
  projectState: 'Closed',
  currentPhaseName: { _id: 'ph-w', name: 'Withdrawal' },
  eacDecision: { _id: 'dec-w', name: 'Withdrawn' },
  decisionDate: '2016-03-02T08:00:00.000Z',
} as DemiProject;

/** A period that opened last week and closes on November 4 in BC. */
const OPEN_PERIOD = {
  id: 'cp-open',
  dateStarted: '2026-10-20T15:00:00.000Z',
  dateCompleted: '2026-11-04T20:00:00.000Z',
};
const UPCOMING_PERIOD = {
  id: 'cp-next',
  dateStarted: '2026-11-16T16:00:00.000Z',
  dateCompleted: '2026-12-16T20:00:00.000Z',
};
const CLOSED_PERIOD = {
  id: 'cp-done',
  dateStarted: '2026-05-01T15:00:00.000Z',
  dateCompleted: '2026-06-01T20:00:00.000Z',
};

const originalEnv = window.__env;

beforeEach(async () => {
  window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: DEMI };
  await loadConfig();
  // The comment-period read looks the DEMI id up through the app's own cache.
  queryClient.clear();
  vi.stubEnv('TZ', 'America/Vancouver');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.__env = originalEnv;
});

/** Renders `doc`'s summary; the comment-period read answers `periods`, or waits on it. */
function renderSummary(doc: DemiProject, periods: unknown[] | Promise<Response> = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith(`${DEMI}/`)) return json(doc);
      if (url.includes('/demi/api/comment-periods')) {
        return Array.isArray(periods) ? native(periods) : periods;
      }
      return native([]);
    }),
  );
  const projId = doc.eagleId!;
  renderAt(`/p/${projId}/overview`, [
    {
      path: '/p/:projId/overview',
      element: <ProjectSummary project={Project.fromNative(doc)} projId={projId} lists={[]} />,
    },
  ]);
}

const summary = () => screen.getByRole('region', { name: 'Project status' });
/** The "Decision" badge beside the heading, `null` when there is none. */
const badge = () => within(summary()).queryByText('Decision')?.closest('p') ?? null;
const term = (label: string) => within(summary()).queryByText(label, { selector: 'dt' });
/** The `dd` beside a fact's label. */
const value = (label: string) =>
  within(summary()).getByText(label, { selector: 'dt' }).nextElementSibling;
/** A link whose name starts with `label`; the rest is the new-tab hint. */
const linkNamed = (label: string) =>
  within(summary()).queryByRole('link', { name: new RegExp(`^${label}`) });

describe('project summary, active assessment work (case A)', () => {
  it('heads the summary with the work type and its first unfinished phase', async () => {
    renderSummary(caseA());

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Assessment • Process Planning' }),
    ).toBeInTheDocument();
  });

  it("shows the open phase's start and anticipated end, as the calendar day Track sent", async () => {
    renderSummary(caseA());

    expect(await screen.findByText('September 1, 2026')).toBeInTheDocument();
    expect(value('Phase Start')).toHaveTextContent('September 1, 2026');
    expect(value('Anticipated Phase End')).toHaveTextContent('December 15, 2026');
    expect(value('Entered the EA Process')).toHaveTextContent('December 2, 2019');
  });

  it('shows type and sub-type as the category, and links the legislation it names', async () => {
    renderSummary(caseA());

    await waitFor(() =>
      expect(value('Project Category')).toHaveTextContent(
        'Energy-Petroleum & Natural Gas · LNG Facility',
      ),
    );
    expect(linkNamed(CEDAR.legislation!)).toHaveAttribute('href', EAA_2018);
  });

  it('leaves the EA decision out while it is still "In Progress"', async () => {
    renderSummary(caseA());

    await screen.findByText('September 1, 2026');
    // CEDAR's fixture decision is "In Progress".
    expect(term('EA decision')).toBeNull();
    expect(badge()).toBeNull();
  });

  it('shows a decision with its date and certificate number once there is one', async () => {
    renderSummary({
      ...caseA(),
      eacDecision: { _id: 'dec', name: 'Certificate Issued' },
      decisionDate: '2023-03-14T07:00:00.000Z',
    } as DemiProject);

    expect(await within(summary()).findByRole('link', { name: 'E23-01' })).toHaveAttribute(
      'href',
      '/p/cedar/decisions',
    );
    expect(value('EA decision')).toHaveTextContent('Certificate Issued');
    expect(value('EA decision')).toHaveTextContent('March 14, 2023');
  });

  it('still shows the anticipated end late on its last day in BC, after midnight UTC', async () => {
    vi.setSystemTime(new Date('2026-10-27T05:00:00.000Z'));
    renderSummary(caseA('2026-10-26T00:00:00.000Z'));

    await screen.findByText('September 1, 2026');
    expect(value('Anticipated Phase End')).toHaveTextContent('October 26, 2026');
  });

  it('drops the anticipated end once its last day in BC is over', async () => {
    vi.setSystemTime(new Date('2026-10-27T08:00:00.000Z'));
    renderSummary(caseA('2026-10-26T00:00:00.000Z'));

    await screen.findByText('September 1, 2026');
    expect(term('Anticipated Phase End')).toBeNull();
    expect(screen.queryByText('October 26, 2026')).toBeNull();
  });

  it('drops the anticipated end at BC midnight on a page left open, with no new request', async () => {
    vi.useFakeTimers();
    // Testing Library drains its event wrapper on a setTimeout it only advances when `jest` exists.
    vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime });
    // 23:59 in BC on October 26, the open phase's last day.
    vi.setSystemTime(new Date('2026-10-27T06:59:00.000Z'));
    renderSummary(caseA('2026-10-26T00:00:00.000Z'));

    expect(await screen.findByText('October 26, 2026')).toBeInTheDocument();
    const requests = vi.mocked(fetch).mock.calls.length;

    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000));

    expect(term('Anticipated Phase End')).toBeNull();
    expect(value('Phase Start')).toHaveTextContent('September 1, 2026');
    expect(vi.mocked(fetch).mock.calls.length).toBe(requests);
  });

  it('holds the phase facts as placeholders until the comment periods answer', async () => {
    let answer: (response: Response) => void = () => undefined;
    renderSummary(caseA(), new Promise<Response>((resolve) => (answer = resolve)));

    await screen.findByRole('heading', { level: 2, name: 'Assessment • Process Planning' });
    expect(term('Phase Start')).toBeInTheDocument();
    expect(screen.queryByText('September 1, 2026')).toBeNull();

    act(() => answer(native([UPCOMING_PERIOD])));

    expect(await screen.findByText('September 1, 2026')).toBeInTheDocument();
    expect(value('Next Public Engagement')).toHaveTextContent('November 16, 2026');
  });
});

describe('project summary, EA work other than an assessment (Type 01, case B)', () => {
  it("heads the summary with the project's current phase, not the notification work", async () => {
    renderSummary(NOTIFIED);

    // The entry date comes from the DEMI document, so the heading has settled by then.
    expect(await within(summary()).findByText('November 15, 2008')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Application Development and Review' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Project Notification •/)).toBeNull();
    expect(badge()).toBeNull();
    expect(summary()).not.toHaveClass('project-summary--decided');
  });

  it("shows no phase dates, even the notification work's own", async () => {
    renderSummary(NOTIFIED, [OPEN_PERIOD]);

    expect(await screen.findByText('Open until November 4, 2026')).toBeInTheDocument();
    expect(term('Phase Start')).toBeNull();
    expect(term('Anticipated Phase End')).toBeNull();
    expect(screen.queryByText('August 4, 2026')).toBeNull();
    expect(screen.queryByText('December 1, 2026')).toBeNull();
    expect(value('Entered the EA Process')).toHaveTextContent('November 15, 2008');
  });
});

describe('project summary, post-decision work (Type 04)', () => {
  it('heads the summary with the amendment and its open phase, beside the Track decision', async () => {
    renderSummary(CARIBOO);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Amendment • Amendment Review' }),
    ).toBeInTheDocument();
    // Track's decision date is a calendar day; read in Pacific time it would be October 9.
    expect(badge()).toHaveTextContent('Certificate Issued · October 10, 2023 · M23-01');
    expect(within(badge()!).getByRole('link', { name: 'M23-01' })).toHaveAttribute(
      'href',
      '/p/cariboo/decisions',
    );
    expect(summary()).toHaveClass('project-summary--decided');
  });

  it("shows the amendment phase's dates and keeps the decision out of the facts", async () => {
    renderSummary(CARIBOO);

    expect(await screen.findByText('August 4, 2026')).toBeInTheDocument();
    expect(value('Phase Start')).toHaveTextContent('August 4, 2026');
    expect(value('Anticipated Phase End')).toHaveTextContent('December 1, 2026');
    expect(term('EA decision')).toBeNull();
  });

  it('heads an Eagle-only project with its post-decision work phase, and no phase dates', async () => {
    renderSummary(
      {
        ...SITE_C,
        currentPhaseName: { _id: 'ph-am', name: 'Post Decision - Amendment' },
      } as DemiProject,
      [UPCOMING_PERIOD],
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Post Decision - Amendment' }),
    ).toBeInTheDocument();
    // The heading reads the shell's project; the badge waits on the DEMI document.
    await waitFor(() => expect(badge()).toHaveTextContent('Certificate Issued · October 14, 2014'));
    expect(await screen.findByText('November 16, 2026')).toBeInTheDocument();
    expect(term('Phase Start')).toBeNull();
    expect(term('EA decision')).toBeNull();
  });
});

describe('project summary, left EAO regulation (Type 02)', () => {
  it('heads the summary with the exit decision, with no badge and the decision fact kept', async () => {
    renderSummary(WITHDRAWN);

    expect(await screen.findByRole('heading', { level: 2, name: 'Withdrawn' })).toBeInTheDocument();
    expect(badge()).toBeNull();
    expect(summary()).not.toHaveClass('project-summary--decided');
    expect(value('EA decision')).toHaveTextContent('Withdrawn');
    expect(value('EA decision')).toHaveTextContent('March 2, 2016');
  });

  it('heads a closed project with no decision on record "Closed"', async () => {
    renderSummary({
      ...WITHDRAWN,
      eacDecision: { _id: 'dec-ip', name: 'In Progress' },
      decisionDate: undefined,
    } as DemiProject);

    expect(await screen.findByRole('heading', { level: 2, name: 'Closed' })).toBeInTheDocument();
    expect(badge()).toBeNull();
    expect(term('EA decision')).toBeNull();
  });
});

describe('project summary, 2002 Act with no Track work, certified (Site C, Type 03)', () => {
  it('heads the summary with the stage, beside a badge with the Eagle decision', async () => {
    renderSummary(SITE_C);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Construction' }),
    ).toBeInTheDocument();
    expect(badge()).toHaveTextContent('Certificate Issued · October 14, 2014');
    expect(within(badge()!).queryByRole('link')).toBeNull();
    expect(summary()).toHaveClass('project-summary--decided');
    expect(term('EA decision')).toBeNull();
  });

  it('links the certificate number in the badge to the Decisions tab', async () => {
    renderSummary({ ...SITE_C, eaCertificate: 'E14-02' } as DemiProject);

    const link = await within(summary()).findByRole('link', { name: 'E14-02' });
    expect(link).toHaveAttribute('href', '/p/site-c/decisions');
    expect(badge()).toContainElement(link);
    expect(badge()).toHaveTextContent('Certificate Issued · October 14, 2014 · E14-02');
  });

  it('shows the record facts and the next engagement, with no phase dates and no 2018 Act', async () => {
    renderSummary(SITE_C, [UPCOMING_PERIOD]);

    expect(await screen.findByText('November 16, 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Construction' })).toBeInTheDocument();
    expect(value('Project Category')).toHaveTextContent('Energy-Electricity · Hydroelectric');
    expect(value('Entered the EA Process')).toHaveTextContent('August 1, 2011');
    expect(value('Legislation')).toHaveTextContent(ACT_2002);
    expect(linkNamed(ACT_2002)).toHaveAttribute('href', EAA_2002);
    expect(term('Phase Start')).toBeNull();
    expect(term('Anticipated Phase End')).toBeNull();
    expect(within(summary()).queryByText(/2018/)).toBeNull();
  });

  it('leaves out the whole phase box, never a "-", when there is nothing to put in it', async () => {
    renderSummary(SITE_C, [CLOSED_PERIOD]);

    await waitForElementToBeRemoved(() => term('Next Public Engagement'));
    expect(term('Phase Start')).toBeNull();
    expect(within(summary()).queryByText('-')).toBeNull();
    expect(value('Legislation')).toHaveTextContent(ACT_2002);
  });

  it('shows legislation no Act matches as plain text, never as the 2018 Act', async () => {
    renderSummary({ ...SITE_C, legislation: 'Environmental Management Act' } as DemiProject);

    await waitForElementToBeRemoved(() => term('Next Public Engagement'));
    expect(value('Legislation')).toHaveTextContent('Environmental Management Act');
    expect(linkNamed('Environmental Management Act')).toBeNull();
    expect(within(summary()).queryByText(/2018/)).toBeNull();
  });

  it('drops the heading and the facts it has no value for', async () => {
    renderSummary({
      ...SITE_C,
      currentPhaseName: undefined,
      projectType: undefined,
      sector: undefined,
      assessments: [],
    } as DemiProject);

    await waitForElementToBeRemoved(() => term('Next Public Engagement'));
    expect(
      within(summary())
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Assessment progress']);
    expect(term('Project Category')).toBeNull();
    expect(term('Entered the EA Process')).toBeNull();
    expect(within(summary()).queryByText('-')).toBeNull();
  });
});
