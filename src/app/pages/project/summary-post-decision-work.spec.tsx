import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import {
  ACT_2002,
  UPCOMING_PERIOD,
  currentStage,
  findHeading,
  rail,
  renderSummary,
  summary,
  term,
  pinSummaryClock,
  value,
} from './fixtures/summary-render';
import { TRANSITIONED, work } from './timeline.fixture';

pinSummaryClock();

/** Cariboo Gold's 2018 assessment: Track granted it, Eagle still says "In Progress". */
const GRANTED_ASSESSMENT = work({
  workTypeId: 6,
  workType: 'Assessment',
  workState: 'COMPLETED',
  outcome: 'Environmental Assessment Certificate GRANTED',
  decisionDate: '2023-10-10T00:00:00.000Z',
});

/** Cariboo Gold: certified in Track, now in an amendment (Type 04), in Operation. */
function cariboo(phases: unknown[], fields: Record<string, unknown> = {}): DemiProject {
  return {
    ...TRANSITIONED,
    eagleId: 'cariboo',
    id: 45,
    projectType: 'Mines',
    projectSubType: 'Gold',
    projectState: 'Operation',
    activeWork: { trackWorkId: 901, workType: 'Amendment' },
    works: [
      GRANTED_ASSESSMENT,
      work({
        trackWorkId: 901,
        workTypeId: 7,
        workType: 'Amendment',
        isActive: true,
        workState: 'IN_PROGRESS',
        phases,
      }),
    ],
    assessments: [{ phases: [{ name: 'Pre-Application', startDate: '2008-11-15T08:00:00.000Z' }] }],
    ...fields,
  } as DemiProject;
}

const INTAKE = {
  name: 'Amendment Intake',
  startDate: '2026-05-01T00:00:00.000Z',
  endDate: '2026-08-03T00:00:00.000Z',
  isCompleted: true,
};
const REVIEW = {
  name: 'Amendment Review',
  startDate: '2026-08-04T00:00:00.000Z',
  endDate: '2026-12-01T00:00:00.000Z',
  isCompleted: false,
};
const DECISION = { name: 'Amendment Decision', isCompleted: false };

/** Site C on its 2002 certificate, in an amendment Track knows nothing of. */
const EAGLE_ONLY: DemiProject = {
  eagleId: 'site-c',
  id: 88,
  name: 'Site C Clean Energy Project',
  legislation: ACT_2002,
  legislationYearList: [2002],
  currentLegislationYear: 'legislation_2002',
  projectType: 'Energy-Electricity',
  sector: 'Hydroelectric',
  projectState: 'Construction',
  currentPhaseName: { _id: 'ph-am', name: 'Post Decision - Amendment' },
  eacDecision: { _id: 'dec-2002', name: 'Certificate Issued' },
  decisionDate: '2014-10-14T07:00:00.000Z',
  activeWork: null,
  assessments: [{ phases: [{ name: 'Pre-Application', startDate: '2011-08-01T07:00:00.000Z' }] }],
} as DemiProject;

describe('Type 04 with Track work', () => {
  it('heads the summary with the work and its open phase, over the Track decision', async () => {
    renderSummary(cariboo([INTAKE, REVIEW, DECISION]));

    const heading = await findHeading('Amendment • Amendment Review');
    // Track's decision date is a calendar day; read in Pacific time it would be October 9.
    expect(heading.nextElementSibling).toHaveTextContent(
      'Decision: Certificate Issued on October 10, 2023 (M23-01)',
    );
    expect(within(summary()).getByRole('link', { name: 'M23-01' })).toHaveAttribute(
      'href',
      '/p/cariboo/decisions',
    );
  });

  it("draws the work's phases on its own rail", async () => {
    renderSummary(cariboo([INTAKE, REVIEW, DECISION]));

    await findHeading('Amendment • Amendment Review');
    expect(within(rail('Amendment progress')).getAllByRole('listitem')).toHaveLength(3);
    expect(currentStage('Amendment progress')).toHaveTextContent(/^Amendment Review/);
    expect(within(summary()).queryByRole('region', { name: 'Assessment progress' })).toBeNull();
  });

  it("shows the open phase's dates and the project stage, never an EA decision row", async () => {
    renderSummary(cariboo([INTAKE, REVIEW, DECISION]));

    await findHeading('Amendment • Amendment Review');
    expect(value('Phase Start')).toHaveTextContent('August 4, 2026');
    expect(value('Anticipated Phase End')).toHaveTextContent('December 1, 2026');
    expect(value('Project Stage')).toHaveTextContent('Operation');
    expect(term('EA decision')).toBeNull();
  });

  it('shows the certificate expiry while it lies ahead', async () => {
    renderSummary(cariboo([REVIEW], { eacExpires: '2035-06-17T07:00:00.000Z' }));

    await findHeading('Amendment • Amendment Review');
    expect(value('Certificate Expires')).toHaveTextContent('June 17, 2035');
  });

  it('heads work with every phase complete by its work type alone', async () => {
    renderSummary(cariboo([INTAKE, { ...REVIEW, isCompleted: true }]));

    await findHeading('Amendment');
    expect(currentStage('Amendment progress')).toBeNull();
    expect(within(rail('Amendment progress')).getAllByText('Completed')).toHaveLength(2);
  });
});

describe('Type 04 with Track work and no phases', () => {
  it("draws the Act's stages in place of an empty work rail", async () => {
    renderSummary(cariboo([]));

    await findHeading('Amendment');
    expect(rail('Assessment progress')).toBeInTheDocument();
    expect(within(summary()).queryByRole('region', { name: 'Amendment progress' })).toBeNull();
  });
});

describe('Type 04 with Eagle-only work', () => {
  it("heads the summary with Eagle's post-decision phase in Track's spelling", async () => {
    renderSummary(EAGLE_ONLY);

    const heading = await findHeading('Amendment');
    expect(heading.nextElementSibling).toHaveTextContent(
      'Decision: Certificate Issued on October 14, 2014',
    );
  });

  it("draws the Act's stages and leaves the phase dates out", async () => {
    renderSummary(EAGLE_ONLY, { periods: [UPCOMING_PERIOD] });

    expect(await screen.findByText('November 16, 2026')).toBeInTheDocument();
    expect(rail('Assessment progress')).toBeInTheDocument();
    expect(term('Phase Start')).toBeNull();
    expect(term('Anticipated Phase End')).toBeNull();
    expect(value('Project Stage')).toHaveTextContent('Construction');
  });
});
