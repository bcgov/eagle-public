import { describe, it, expect, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import { native } from '../home/home-fetch.spec-helper';
import {
  ACT_2002,
  ACT_2018,
  EAA_2018,
  OPEN_PERIOD,
  UPCOMING_PERIOD,
  currentStage,
  eaglePhase,
  findHeading,
  headings,
  linkNamed,
  renderSummary,
  summary,
  term,
  pinSummaryClock,
  value,
} from './fixtures/summary-render';
import { work } from './timeline.fixture';

pinSummaryClock();

const done = (name: string, start: string, end: string) => ({
  name,
  startDate: `${start}T00:00:00.000Z`,
  endDate: `${end}T00:00:00.000Z`,
  isCompleted: true,
});
const open = (name: string, start?: string, end?: string) => ({
  name,
  startDate: start ? `${start}T00:00:00.000Z` : null,
  endDate: end ? `${end}T00:00:00.000Z` : null,
  isCompleted: false,
});

const EARLY = done('Early Engagement', '2019-12-02', '2020-06-01');
const READINESS = done('Readiness Decision', '2020-06-02', '2020-08-01');
const PLANNING = open('Process Planning', '2026-09-01', '2026-12-15');
const APPLICATION = open('EAC Application Development (Proponent Time)');

/** A 2018 assessment in Track (work type 6), Eagle's phase `eagle`, the work's phases `phases`. */
function assessing(
  phases: unknown[] = [EARLY, READINESS, PLANNING, APPLICATION],
  { eagle = 'Process Planning', ...workFields }: { eagle?: string } & Record<string, unknown> = {},
  fields: Record<string, unknown> = {},
): DemiProject {
  return {
    eagleId: 'yellowhead',
    id: 7,
    name: 'Yellowhead Mine',
    legislation: ACT_2018,
    legislationYearList: [2018],
    currentLegislationYear: 'legislation_2018',
    projectType: 'Energy-Petroleum & Natural Gas',
    projectSubType: 'LNG Facility',
    currentPhaseName: eaglePhase(eagle),
    eacDecision: { _id: 'dec-ip', name: 'In Progress' },
    eaCertificate: 'E23-01',
    activeWork: { trackWorkId: 900, workType: 'Assessment' },
    works: [
      work({
        trackWorkId: 900,
        workTypeId: 6,
        workType: 'Assessment',
        isActive: true,
        workState: 'IN_PROGRESS',
        phases,
        ...workFields,
      }),
    ],
    phases,
    // Midnight UTC, which a Pacific `longDate` would show as December 1.
    assessments: [
      { phases: [{ name: 'Early Engagement', startDate: '2019-12-02T00:00:00.000Z' }] },
    ],
    ...fields,
  } as DemiProject;
}

/** Track phases up to an open EAC Decision, the Referral stage, starting `start`. */
const inDecision = (start = '2026-09-01', end?: string) => [
  EARLY,
  READINESS,
  done('Process Planning', '2020-09-01', '2021-01-01'),
  done('EAC Application Review', '2021-01-02', '2022-01-01'),
  done('Effects Assessment & Recommendation', '2022-01-02', '2023-01-01'),
  open('EAC Decision', start, end),
];

/** The sentence under the summary heading. */
async function lineUnder(heading: string) {
  return (await findHeading(heading)).nextElementSibling;
}

describe('Type 01 summary head', () => {
  it('heads the summary with the work type and its first unfinished phase', async () => {
    renderSummary(assessing());

    expect(await findHeading('Assessment • Process Planning')).toBeInTheDocument();
  });

  it("heads a project with no work and no Eagle phase 'Stage not recorded'", async () => {
    renderSummary(assessing([], {}, { activeWork: null, works: [], currentPhaseName: undefined }));

    await findHeading('Stage not recorded');
    expect(headings()).toEqual(['Stage not recorded']);
  });

  it('names the next stage and the month Track expects the decision', async () => {
    renderSummary(assessing(undefined, { anticipatedDecisionDate: '2027-06-01' }));

    expect(await lineUnder('Assessment • Process Planning')).toHaveTextContent(
      'Next: Application Development and Review, with a decision expected in Jun 2027.',
    );
  });

  it("takes the last phase's planned end once the anticipated decision is past", async () => {
    renderSummary(
      assessing(
        [EARLY, READINESS, PLANNING, open('EAC Application Review', undefined, '2027-03-31')],
        {
          anticipatedDecisionDate: '2025-01-01',
        },
      ),
    );

    expect(await lineUnder('Assessment • Process Planning')).toHaveTextContent(
      'Next: Application Development and Review, with a decision expected in Mar 2027.',
    );
  });

  it('names only the next stage when no decision date lies ahead', async () => {
    renderSummary(assessing());

    expect(await lineUnder('Assessment • Process Planning')).toHaveTextContent(
      /^Next: Application Development and Review\.$/,
    );
  });

  it('never names the post-decision stage as next, giving the decision month alone', async () => {
    renderSummary(
      assessing(inDecision(), { eagle: 'Referral', anticipatedDecisionDate: '2027-06-01' }),
    );

    expect(await lineUnder('Assessment • EAC Decision')).toHaveTextContent(
      /^Decision expected in Jun 2027\.$/,
    );
  });

  it('says since when the project is in the phase when nothing else is known', async () => {
    renderSummary(assessing(inDecision('2026-09-01'), { eagle: 'Referral' }));

    expect(await lineUnder('Assessment • EAC Decision')).toHaveTextContent(
      /^In this phase since September 1, 2026\.$/,
    );
  });

  it('shows the heading alone when the phase starts after today', async () => {
    renderSummary(assessing(inDecision('2026-11-15'), { eagle: 'Referral' }));

    expect(await lineUnder('Assessment • EAC Decision')).toBeNull();
  });

  it('holds the sentence back while the stage list loads', async () => {
    renderSummary(assessing(), { listsLoading: true });

    expect(await lineUnder('Assessment • Process Planning')).toBeNull();
  });
});

describe('Type 01 rail', () => {
  it("keeps Eagle's stage current when Track's open phase dates no stage", async () => {
    renderSummary(assessing([EARLY, open('Federal Coordination', '2026-09-01')]));

    await findHeading('Assessment • Federal Coordination');
    expect(currentStage('Assessment progress')).toHaveTextContent(/^Process Planning/);
  });

  it("marks Track's open phase current when Eagle's phase lags behind", async () => {
    renderSummary(
      assessing(
        [
          EARLY,
          READINESS,
          done('Process Planning', '2020-09-01', '2021-01-01'),
          done('EAC Application Review', '2021-01-02', '2022-01-01'),
          open('Effects Assessment & Recommendation', '2022-01-02'),
        ],
        { eagle: 'Process Planning' },
      ),
    );

    expect(await lineUnder('Assessment • Effects Assessment & Recommendation')).toHaveTextContent(
      /^Next: Referral\.$/,
    );
    expect(currentStage('Assessment progress')).toHaveTextContent(/^Effects Assessment/);
  });

  it("draws other EA work's own phases and names the next one", async () => {
    renderSummary(
      assessing(
        [open('Notification Review', '2026-08-04', '2026-12-01'), open('Notification Decision')],
        { workTypeId: 1, workType: 'Project Notification' },
        { activeWork: { trackWorkId: 900, workType: 'Project Notification' } },
      ),
    );

    expect(await lineUnder('Project Notification • Notification Review')).toHaveTextContent(
      /^Next: Notification Decision\.$/,
    );
    expect(currentStage('Project Notification progress')).toHaveTextContent(/^Notification Review/);
    expect(within(summary()).queryByRole('region', { name: 'Assessment progress' })).toBeNull();
    expect(value('Phase Start')).toHaveTextContent('August 4, 2026');
  });
});

describe('Type 01 facts', () => {
  it("shows the open phase's start and anticipated end, as the calendar day Track sent", async () => {
    renderSummary(assessing());

    expect(await screen.findByText('September 1, 2026')).toBeInTheDocument();
    expect(value('Phase Start')).toHaveTextContent('September 1, 2026');
    expect(value('Anticipated Phase End')).toHaveTextContent('December 15, 2026');
    expect(value('Entered the EA Process')).toHaveTextContent('December 2, 2019');
  });

  it('shows type and sub-type as the category, and links the legislation it names', async () => {
    renderSummary(assessing());

    await screen.findByText('September 1, 2026');
    expect(value('Project Category')).toHaveTextContent(
      'Energy-Petroleum & Natural Gas · LNG Facility',
    );
    expect(linkNamed(ACT_2018)).toHaveAttribute('href', EAA_2018);
  });

  it('leaves the EA decision out while it is still "In Progress"', async () => {
    renderSummary(assessing());

    await screen.findByText('September 1, 2026');
    expect(term('EA decision')).toBeNull();
  });

  it('shows a decision with its date and certificate number once there is one', async () => {
    renderSummary(
      assessing(
        undefined,
        {},
        {
          eacDecision: { _id: 'dec', name: 'Certificate Issued' },
          decisionDate: '2023-03-14T07:00:00.000Z',
        },
      ),
    );

    expect(await within(summary()).findByRole('link', { name: 'E23-01' })).toHaveAttribute(
      'href',
      '/p/yellowhead/decisions',
    );
    expect(value('EA decision')).toHaveTextContent('Certificate Issued');
    expect(value('EA decision')).toHaveTextContent('March 14, 2023');
  });

  it('marks a fact with no value "Not set", never "-"', async () => {
    renderSummary(assessing([EARLY, open('Process Planning')], {}, { legislation: undefined }));

    await findHeading('Assessment • Process Planning');
    expect(value('Phase Start')).toHaveTextContent('Not set');
    expect(value('Anticipated Phase End')).toHaveTextContent('Not set');
    expect(value('Legislation')).toHaveTextContent('Not set');
    expect(within(summary()).queryByText('-')).toBeNull();
  });

  it('drops an anticipated end Track dated before the phase start', async () => {
    renderSummary(assessing([EARLY, open('Process Planning', '2027-01-15', '2026-12-01')]));

    await screen.findByText('January 15, 2027');
    expect(value('Anticipated Phase End')).toHaveTextContent('Not set');
  });

  it('still shows the anticipated end late on its last day in BC, after midnight UTC', async () => {
    vi.setSystemTime(new Date('2026-10-27T05:00:00.000Z'));
    renderSummary(assessing([EARLY, open('Process Planning', '2026-09-01', '2026-10-26')]));

    await screen.findByText('September 1, 2026');
    expect(value('Anticipated Phase End')).toHaveTextContent('October 26, 2026');
  });

  it('drops the anticipated end once its last day in BC is over', async () => {
    vi.setSystemTime(new Date('2026-10-27T08:00:00.000Z'));
    renderSummary(assessing([EARLY, open('Process Planning', '2026-09-01', '2026-10-26')]));

    await screen.findByText('September 1, 2026');
    expect(value('Anticipated Phase End')).toHaveTextContent('Not set');
    expect(screen.queryByText('October 26, 2026')).toBeNull();
  });

  it('drops the anticipated end at BC midnight on a page left open, with no new request', async () => {
    vi.useFakeTimers();
    // Testing Library drains its event wrapper on a setTimeout it only advances when `jest` exists.
    vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime });
    // 23:59 in BC on October 26, the open phase's last day.
    vi.setSystemTime(new Date('2026-10-27T06:59:00.000Z'));
    renderSummary(assessing([EARLY, open('Process Planning', '2026-09-01', '2026-10-26')]));

    expect(await screen.findByText('October 26, 2026')).toBeInTheDocument();
    const requests = vi.mocked(fetch).mock.calls.length;

    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000));

    expect(value('Anticipated Phase End')).toHaveTextContent('Not set');
    expect(value('Phase Start')).toHaveTextContent('September 1, 2026');
    expect(vi.mocked(fetch).mock.calls.length).toBe(requests);
  });

  it('holds the phase facts as placeholders until the comment periods answer', async () => {
    let answer: (response: Response) => void = () => undefined;
    renderSummary(assessing(), {
      periods: new Promise<Response>((resolve) => (answer = resolve)),
    });

    await findHeading('Assessment • Process Planning');
    expect(term('Phase Start')).toBeInTheDocument();
    expect(screen.queryByText('September 1, 2026')).toBeNull();

    act(() => answer(native([UPCOMING_PERIOD])));

    expect(await screen.findByText('September 1, 2026')).toBeInTheDocument();
    expect(value('Next Public Engagement')).toHaveTextContent('November 16, 2026');
  });

  it('shows an open comment period until the day it closes', async () => {
    renderSummary(assessing(), { periods: [OPEN_PERIOD] });

    expect(await screen.findByText('Open until November 4, 2026')).toBeInTheDocument();
  });
});

describe('Type 01 phase text', () => {
  it("shows ENGAGE's text for the 2018 phase the project is in", async () => {
    renderSummary(assessing());

    expect(
      await screen.findByText(
        /^Engage with Indigenous nations, stakeholders, technical experts to establish/,
      ),
    ).toBeInTheDocument();
  });

  it('reads a proponent-time Track phase as the stage it dates', async () => {
    renderSummary(
      assessing([
        EARLY,
        READINESS,
        done('Process Planning', '2020-09-01', '2021-01-01'),
        APPLICATION,
      ]),
    );

    expect(
      await screen.findByText(/^Proponent consults and does technical studies/),
    ).toBeInTheDocument();
  });

  it('shows no phase text for EA work other than an assessment', async () => {
    renderSummary(
      assessing([open('Process Planning', '2026-09-01')], {
        workTypeId: 1,
        workType: 'Project Notification',
      }),
    );

    await findHeading('Project Notification • Process Planning');
    expect(screen.queryByText(/^Engage with Indigenous nations/)).toBeNull();
  });

  it('shows no phase text under the 2002 Act', async () => {
    renderSummary(
      assessing(
        [],
        {},
        {
          legislation: ACT_2002,
          legislationYearList: [2002],
          currentLegislationYear: 'legislation_2002',
          currentPhaseName: eaglePhase('Application Review', 2002),
          activeWork: null,
          works: [],
        },
      ),
    );

    await findHeading('Application Review');
    expect(within(summary()).queryByText(/Indigenous nations|Decision point/)).toBeNull();
  });
});
