import { describe, it, expect } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import { queryClient } from 'app/api/query-client';
import { json } from '../home/home-fetch.spec-helper';
import {
  ACT_2018,
  DEMI,
  eaglePhase,
  findHeading,
  renderSummary,
  requestedUrls,
  summary,
  term,
  pinSummaryClock,
} from './fixtures/summary-render';

pinSummaryClock();

/** Certified in Eagle, so the DEMI document makes it Type 03; Eagle alone reads as Type 01. */
const DECIDED: DemiProject = {
  eagleId: 'decided',
  id: 12,
  name: 'Decided Mine',
  legislation: ACT_2018,
  legislationYearList: [2018],
  currentLegislationYear: 'legislation_2018',
  projectState: 'Operation',
  currentPhaseName: eaglePhase('Post Decision - Operation'),
  eacDecision: { _id: 'dec', name: 'Certificate Issued' },
  decisionDate: '2020-05-01T07:00:00.000Z',
  activeWork: null,
} as DemiProject;

describe('project summary shell', () => {
  it('holds placeholders, marked busy, until the DEMI document picks the layout', async () => {
    let answer: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (answer = resolve));
    renderSummary(DECIDED, { demi: () => held });

    expect(summary()).toHaveAttribute('aria-busy', 'true');
    expect(within(summary()).getByText('Loading project status')).toBeInTheDocument();
    expect(within(summary()).queryByRole('heading', { level: 2 })).toBeNull();
    // Only rows every layout fills: an engagement row may never come.
    expect(term('Anticipated Phase End')).toBeInTheDocument();
    expect(term('Next Public Engagement')).toBeNull();

    act(() => answer(json(DECIDED)));

    expect(await findHeading('Operation')).toBeInTheDocument();
    expect(summary()).not.toHaveAttribute('aria-busy');
    expect(screen.queryByText('Loading project status')).toBeNull();
  });

  it("falls back to Type 01 on Eagle's record when the DEMI read fails, and stops reading", async () => {
    const rendered = renderSummary(DECIDED, { demi: async () => json({ message: 'down' }, 500) });
    const key = ['demi-project', DECIDED.eagleId];
    const reads = () => requestedUrls().filter((url) => url.startsWith(`${DEMI}/`)).length;
    const answered = () =>
      [rendered.queryClient, queryClient]
        .map((client) => client.getQueryState(key)?.errorUpdateCount ?? 0)
        .reduce((sum, count) => sum + count);

    expect(await findHeading('Post Decision - Operation')).toBeInTheDocument();
    // Comment-period lookup (app cache), first mount, fallback's mount: the loop would add more.
    await waitFor(() => expect(answered()).toBe(reads()));

    expect(reads()).toBeLessThanOrEqual(3);
    expect(summary()).not.toHaveAttribute('aria-busy');
    expect(within(summary()).getByRole('region', { name: 'Assessment progress' })).toBeVisible();
  });
});
