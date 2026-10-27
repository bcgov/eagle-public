import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { DemiProject } from 'app/api/api';
import {
  AMENDMENT_DOCUMENTS,
  CEDAR,
  CERTIFIED_2002,
  CROWN_MOUNTAIN,
  SECOND_ASSESSMENT,
  TODAY,
  TRANSITIONED,
  work,
} from './timeline.fixture';
import { TimelineDetails } from './timeline-details';
import { dayDate } from './timeline-list';
import { buildTimelineModel, type TimelineItem } from './use-timeline-model';

function renderDetails(
  project: DemiProject,
  selectedId: string | null,
  hrefFor?: (item: TimelineItem) => string | undefined,
) {
  const model = buildTimelineModel({
    project,
    documents: project === CERTIFIED_2002 ? AMENDMENT_DOCUMENTS : [],
    lists: [],
    today: TODAY,
  });
  const onSelect = vi.fn();
  render(
    <MemoryRouter>
      <TimelineDetails
        model={model}
        selectedId={selectedId}
        onSelect={onSelect}
        hrefFor={hrefFor}
      />
    </MemoryRouter>,
  );
  return { model, onSelect };
}

/** The details' fields as term → value. */
function fields(): Record<string, string> {
  const terms = screen.getAllByRole('term').map((one) => one.textContent ?? '');
  const values = screen.getAllByRole('definition').map((one) => one.textContent ?? '');
  return Object.fromEntries(terms.map((term, i) => [term, values[i]]));
}

describe('TimelineDetails', () => {
  it('is not a live region, so a new selection is not read out field by field', () => {
    renderDetails(CEDAR, 'certificate');

    expect(screen.getByRole('complementary')).not.toHaveAttribute('aria-live');
  });

  it('shows Today when nothing is selected, with the work in progress to jump to', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderDetails(CEDAR, null);

    expect(screen.getByRole('heading', { name: 'Today, 26 Oct 2026' })).toBeInTheDocument();
    expect(fields()).toMatchObject({
      'Current stage': 'Construction (not dated)',
      'Acts on this project': '2018 Act',
    });
    await user.click(screen.getByRole('button', { name: 'Amendment #3' }));
    expect(onSelect).toHaveBeenCalledWith('work-102');
  });

  it('gives open work its status, planned decision and milestones', () => {
    renderDetails(CEDAR, 'work-102');

    // Once as the chip beside the title, once as the Status field.
    expect(screen.getAllByText('In progress')).toHaveLength(2);
    expect(fields()).toMatchObject({
      Type: 'Amendment',
      Received: '6 Oct 2025',
      Status: 'In progress',
      'Planned decision': '15 Mar 2027 (Planned)',
    });
    expect(screen.getByRole('heading', { name: 'Milestones · 4' })).toBeInTheDocument();
  });

  it('gives an issued certificate its date, source and whose time', () => {
    renderDetails(CEDAR, 'certificate');

    expect(fields()).toMatchObject({ Issued: '14 Mar 2023', Source: 'Track' });
    expect(
      screen.getByRole('heading', { name: /^Whose time · 4 Aug 2020 – / }),
    ).toBeInTheDocument();
  });

  it('adds the substantial start deadline to the certificate in force', () => {
    const substantialStart = work({ workTypeId: 10, workType: 'Substantial start' });
    renderDetails({ ...CEDAR, works: [...(CEDAR.works ?? []), substantialStart] }, 'certificate');

    expect(fields()['Substantial start']).toBe('Deadline 14 Mar 2028 · not yet decided');
  });

  it('explains a certificate whose phases were never dated, in place of whose time', () => {
    renderDetails(CERTIFIED_2002, 'certificate');

    expect(screen.queryByRole('heading', { name: /^Whose time/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/weren’t recorded, so assessment time can’t be split/),
    ).toBeInTheDocument();
  });

  it('says a transition date is not recorded and when it must have happened', () => {
    renderDetails(TRANSITIONED, 'transition-2002-2018');

    expect(fields()).toMatchObject({
      From: 'Environmental Assessment Act (2002)',
      To: 'Environmental Assessment Act (2018)',
      Date: 'Not recorded',
    });
    expect(fields()['Happened between']).toMatch(
      /\(last 2002 Act date\) and .* \(first 2018 Act date\)$/,
    );
  });

  it('lists every phase of the Act on its band, marking the ones the project skipped', () => {
    renderDetails(TRANSITIONED, 'band-2002');

    expect(fields()).toMatchObject({ 'In force from': '30 Dec 2002' });
    const phases = screen.getByRole('region', { name: 'Phases and steps under the 2002 Act' });
    expect(within(phases).getByText('Pre-EA')).toBeInTheDocument();
    expect(within(phases).getByText('Evaluation (not on this project)')).toBeInTheDocument();
  });

  it('lists the phases of an earlier Act’s history in order, with no dates', () => {
    renderDetails(TRANSITIONED, 'history-2002');

    expect(fields()).toMatchObject({ 'Phase dates': 'Not dated' });
    const phases = screen.getByRole('region', { name: 'Phases on this project, in order' });
    expect(
      within(phases)
        .getAllByText(/^Pre-/)
        .map((one) => one.textContent),
    ).toEqual(['Pre-EA', 'Pre-Application']);
  });

  it('links a pre-Track document with the document named in the link text', () => {
    const { model } = renderDetails(CERTIFIED_2002, 'document-doc-0', (item) =>
      item.kind === 'document' ? `/documents/${item.documentId}` : undefined,
    );
    const document = model.items.find((item) => item.id === 'document-doc-0')!;

    const link = screen.getByRole('link', {
      name: `Open document: ${document.title}, ${dayDate(document.start)}`,
    });
    expect(link).toHaveAttribute('href', '/documents/doc-0');
    expect(screen.queryByText('Decision')).not.toBeInTheDocument();
  });

  it('gives a running phase its time so far and its planned end, not a finished length', () => {
    renderDetails(CROWN_MOUNTAIN, 'phase-proponent-3');

    expect(fields()).toMatchObject({
      Dates: 'Since 27 May 2026',
      'Planned end': '26 Jan 2027',
    });
    expect(fields()).not.toHaveProperty('Took');
  });

  it('marks a phase that has not started as planned, with no length yet', () => {
    renderDetails(CROWN_MOUNTAIN, 'phase-4');

    expect(fields()).toMatchObject({ Dates: '2 Apr 2027 – 30 Aug 2027 (Planned)' });
    expect(fields()).not.toHaveProperty('Took');
  });

  it('leaves phases that have not started out of whose time', () => {
    renderDetails(CROWN_MOUNTAIN, 'phase-proponent-3');

    const time = screen.getByRole('region', { name: /^Whose time/ });
    expect(within(time).getAllByRole('button')).toHaveLength(4);
    expect(
      within(time).queryByRole('button', { name: /^Effects Assessment/ }),
    ).not.toBeInTheDocument();
  });

  it('draws no link to an unsafe address', () => {
    renderDetails(CERTIFIED_2002, 'document-doc-0', () => 'javascript:alert(1)');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('draws no link when the tab gives none', () => {
    renderDetails(CERTIFIED_2002, 'document-doc-0');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('names the first assessment on the second assessment’s branch start', () => {
    renderDetails(SECOND_ASSESSMENT, 'branch-104');

    expect(fields()['First assessment']).toMatch(/^Assessment terminated, \d+ \w{3} \d{4}$/);
  });
});
