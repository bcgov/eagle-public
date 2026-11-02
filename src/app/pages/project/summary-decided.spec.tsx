import { describe, it, expect, vi } from 'vitest';
import { screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import {
  ACT_2002,
  ACT_2018,
  CLOSED_PERIOD,
  EAA_2002,
  UPCOMING_PERIOD,
  currentStage,
  findHeading,
  linkNamed,
  rail,
  renderSummary,
  summary,
  term,
  pinSummaryClock,
  value,
} from './fixtures/summary-render';

pinSummaryClock();

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

describe('Type 03 summary head', () => {
  it('heads the summary with the stage, over the decision and its date', async () => {
    renderSummary(SITE_C);

    const heading = await findHeading('Construction');
    expect(heading.nextElementSibling).toHaveTextContent(
      /^Decision: Certificate Issued on October 14, 2014$/,
    );
    expect(within(summary()).queryByRole('link', { name: /decisions/i })).toBeNull();
  });

  it('links the certificate number to the Decisions tab', async () => {
    renderSummary({ ...SITE_C, eaCertificate: 'E14-02' } as DemiProject);

    const link = await within(summary()).findByRole('link', { name: 'E14-02' });
    expect(link).toHaveAttribute('href', '/p/site-c/decisions');
    expect(link.closest('p')).toHaveTextContent(
      'Decision: Certificate Issued on October 14, 2014 (E14-02)',
    );
  });

  it('dates an Eagle decision by its BC day, whatever the browser zone', async () => {
    vi.stubEnv('TZ', 'UTC');
    // 20:00 on October 13 in BC, already October 14 in UTC.
    renderSummary({ ...SITE_C, decisionDate: '2014-10-14T03:00:00.000Z' } as DemiProject);

    expect((await findHeading('Construction')).nextElementSibling).toHaveTextContent(
      'October 13, 2014',
    );
  });

  it("heads a project with no stage on record 'Decision made'", async () => {
    renderSummary({ ...SITE_C, currentPhaseName: undefined } as DemiProject);

    await findHeading('Decision made');
    expect(rail('Project lifecycle')).toHaveTextContent('Current stage: Not recorded');
    expect(currentStage('Project lifecycle')).toBeNull();
  });
});

describe('Type 03 rail and facts', () => {
  it('draws the lifecycle with the current stage marked', async () => {
    renderSummary(SITE_C);

    await findHeading('Construction');
    expect(currentStage('Project lifecycle')).toHaveTextContent(/^Construction/);
    expect(within(summary()).queryByRole('region', { name: 'Assessment progress' })).toBeNull();
  });

  it('shows the record facts and the next engagement, with no phase dates', async () => {
    renderSummary(SITE_C, { periods: [UPCOMING_PERIOD] });

    expect(await screen.findByText('November 16, 2026')).toBeInTheDocument();
    expect(value('Project Category')).toHaveTextContent('Energy-Electricity · Hydroelectric');
    expect(value('Entered the EA Process')).toHaveTextContent('August 1, 2011');
    expect(linkNamed(ACT_2002)).toHaveAttribute('href', EAA_2002);
    expect(term('Phase Start')).toBeNull();
    expect(term('Anticipated Phase End')).toBeNull();
    expect(within(summary()).queryByText('Not set')).toBeNull();
  });

  it('shows "None scheduled" when every comment period is over', async () => {
    renderSummary(SITE_C, { periods: [CLOSED_PERIOD] });

    await waitForElementToBeRemoved(() => screen.queryByText('Loading project status'));
    expect(await screen.findByText('None scheduled')).toBeInTheDocument();
    expect(within(summary()).queryByText('-')).toBeNull();
  });

  it('shows legislation no Act matches as plain text, never as the 2018 Act', async () => {
    renderSummary({ ...SITE_C, legislation: 'Environmental Management Act' } as DemiProject);

    await findHeading('Construction');
    expect(value('Legislation')).toHaveTextContent('Environmental Management Act');
    expect(linkNamed('Environmental Management Act')).toBeNull();
    expect(within(summary()).queryByText(/2018/)).toBeNull();
  });

  it('shows the certificate expiry through its last day in BC', async () => {
    // The fixtures' today is October 26, 2026 in BC.
    renderSummary({ ...SITE_C, eacExpires: '2026-10-26T07:00:00.000Z' } as DemiProject);

    await findHeading('Construction');
    expect(value('Certificate Expires')).toHaveTextContent('October 26, 2026');
  });

  it('drops a certificate expiry that is past', async () => {
    renderSummary({ ...SITE_C, eacExpires: '2024-11-25T08:00:00.000Z' } as DemiProject);

    await findHeading('Construction');
    expect(term('Certificate Expires')).toBeNull();
  });

  it("shows ENGAGE's post-certificate text under the 2018 Act", async () => {
    renderSummary({
      ...SITE_C,
      legislation: ACT_2018,
      legislationYearList: [2018],
      currentLegislationYear: 'legislation_2018',
    } as DemiProject);

    expect(
      await screen.findByText(/^Monitor project to make sure requirements are being followed/),
    ).toBeInTheDocument();
  });
});
