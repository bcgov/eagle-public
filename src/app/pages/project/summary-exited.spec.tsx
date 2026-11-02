import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import { LISTS } from './assessment-stages.fixture';
import {
  ACT_2002,
  ACT_2018,
  currentStage,
  eaglePhase,
  findHeading,
  renderSummary,
  requestedUrls,
  summary,
  term,
  pinSummaryClock,
  value,
} from './fixtures/summary-render';
import { work } from './timeline.fixture';

pinSummaryClock();

/** A 2002 project the proponent withdrew; Track has it as Closed. */
const WITHDRAWN: DemiProject = {
  eagleId: 'bear-river',
  id: 88,
  name: 'Bear River',
  legislation: ACT_2002,
  legislationYearList: [2002],
  currentLegislationYear: 'legislation_2002',
  projectType: 'Mines',
  sector: 'Gold',
  projectState: 'Closed',
  currentPhaseName: { _id: 'ph-w', name: 'Withdrawal' },
  eacDecision: { _id: 'dec-w', name: 'Withdrawn' },
  eaCertificate: 'Withdrawn',
  decisionDate: '2016-03-02T08:00:00.000Z',
  activeWork: null,
  assessments: [{ phases: [{ name: 'Pre-Application', startDate: '2011-08-01T07:00:00.000Z' }] }],
} as DemiProject;

const WITHDRAWAL_LABEL = { id: 'label-withdrawal', type: 'label', name: 'Withdrawal' };

const exitedOn = (name: string) =>
  ({ ...WITHDRAWN, eacDecision: { _id: 'dec', name } }) as DemiProject;

describe('Type 02 summary', () => {
  it('heads a withdrawn project with why and when it left', async () => {
    renderSummary(WITHDRAWN);

    const heading = await findHeading('Project Withdrawn');
    expect(heading.nextElementSibling).toHaveTextContent(
      'The proponent withdrew the project from the environmental assessment on March 2, 2016.',
    );
    expect(value('Left the EA Process')).toHaveTextContent('March 2, 2016');
    expect(value('Entered the EA Process')).toHaveTextContent('August 1, 2011');
  });

  it('shows no certificate, no decision line and no phase facts', async () => {
    renderSummary(WITHDRAWN);

    await findHeading('Project Withdrawn');
    expect(within(summary()).queryByText('Withdrawn')).toBeNull();
    expect(within(summary()).queryByText('Decision')).toBeNull();
    expect(term('Phase Start')).toBeNull();
    expect(term('Next Public Engagement')).toBeNull();
  });

  it.each([
    [
      'Certificate Expired',
      'Project Expired',
      "The project's certificate expired on March 2, 2016.",
    ],
    [
      'Regulatory Transfer',
      'Project Transferred',
      'The project moved to another regulator on March 2, 2016.',
    ],
    [
      'Assessment Terminated',
      'Project Terminated',
      'The Environmental Assessment Office ended the assessment on March 2, 2016.',
    ],
    [
      'Not Designated Reviewable',
      'Project Closed',
      'The project did not need an environmental assessment (March 2, 2016).',
    ],
  ])('heads a project that left on %s "%s"', async (decision, heading, reason) => {
    renderSummary(exitedOn(decision));

    expect((await findHeading(heading)).nextElementSibling).toHaveTextContent(reason);
  });

  it('drops the date from the reason when the decision has none', async () => {
    renderSummary({ ...exitedOn('Certificate Cancelled'), decisionDate: undefined } as DemiProject);

    expect((await findHeading('Project Cancelled')).nextElementSibling).toHaveTextContent(
      /^The project's certificate was cancelled\.$/,
    );
    expect(value('Left the EA Process')).toHaveTextContent('Not set');
  });

  it('heads a closed project with no decision on record "Project Closed"', async () => {
    renderSummary({
      ...WITHDRAWN,
      eacDecision: { _id: 'dec-ip', name: 'In Progress' },
      decisionDate: undefined,
    } as DemiProject);

    expect((await findHeading('Project Closed')).nextElementSibling).toHaveTextContent(
      'This project is closed.',
    );
  });

  it("keeps Eagle's stage current on the rail, not a phase Track left open", async () => {
    const effects = { name: 'Effects Assessment & Recommendation', isCompleted: false };
    renderSummary({
      ...WITHDRAWN,
      legislation: ACT_2018,
      legislationYearList: [2018],
      currentLegislationYear: 'legislation_2018',
      currentPhaseName: eaglePhase('Process Planning'),
      phases: [effects],
      works: [
        work({ workTypeId: 6, workType: 'Assessment', workState: 'WITHDRAWN', phases: [effects] }),
      ],
    } as DemiProject);

    await findHeading('Project Withdrawn');
    expect(currentStage('Assessment progress')).toHaveTextContent(/^Process Planning/);
  });
});

describe('Type 02 reason document', () => {
  it('links the newest withdrawal document filed from a week before the decision', async () => {
    renderSummary(WITHDRAWN, {
      lists: [...LISTS, WITHDRAWAL_LABEL],
      documents: [
        {
          id: 'doc-1',
          displayName: 'Confirmation of Withdrawal from the EA Process',
          milestoneId: 'label-withdrawal',
        },
      ],
    });

    expect(
      await within(summary()).findByRole('link', {
        name: /^Confirmation of Withdrawal from the EA Process/,
      }),
    ).toBeInTheDocument();
    expect(term('Reason for Decision')).toBeInTheDocument();
    const reasonRead = requestedUrls().find((url) => url.includes('/demi/api/documents'));
    expect(reasonRead).toContain('pageSize=1');
    expect(reasonRead).toContain('sort=-datePosted');
    expect(reasonRead).toContain('milestoneId=label-withdrawal');
    expect(reasonRead).toContain('datePostedStart=2016-02-24');
  });

  it('leaves the reason row out when no document was filed', async () => {
    renderSummary(WITHDRAWN, { lists: [...LISTS, WITHDRAWAL_LABEL] });

    await findHeading('Project Withdrawn');
    await waitFor(() =>
      expect(requestedUrls().some((url) => url.includes('/documents'))).toBe(true),
    );
    await waitFor(() => expect(term('Reason for Decision')).toBeNull());
    expect(screen.queryByRole('link', { name: /Withdrawal/ })).toBeNull();
  });
});
