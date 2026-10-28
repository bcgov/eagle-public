import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { DemiProject } from 'app/api/api';
import {
  AJAX,
  AJAX_COMMENT_PERIODS,
  AJAX_LISTS,
  AJAX_PHASE_DOCUMENTS,
  AMENDMENT_DOCUMENTS,
  CEDAR,
  CERTIFIED_2002,
  CROWN_MOUNTAIN,
  SECOND_ASSESSMENT,
  TODAY,
  TRANSITIONED,
  phaseDocuments,
  work,
} from './timeline.fixture';
import { TimelineDetails } from './timeline-details';
import { dayDate } from './timeline-list';
import {
  buildTimelineModel,
  type TimelineInput,
  type TimelineItem,
  type TimelineModel,
} from './use-timeline-model';

function renderDetails(
  project: DemiProject,
  selectedId: string | null,
  hrefFor?: (item: TimelineItem) => string | undefined,
  routeBase?: string,
) {
  const model = buildTimelineModel({
    project,
    documents: project === CERTIFIED_2002 ? AMENDMENT_DOCUMENTS : [],
    lists: [],
    today: TODAY,
  });
  return { model, ...renderModel(model, selectedId, hrefFor, routeBase) };
}

function renderModel(
  model: TimelineModel,
  selectedId: string | null,
  hrefFor?: (item: TimelineItem) => string | undefined,
  routeBase?: string,
) {
  const onSelect = vi.fn();
  render(
    <MemoryRouter>
      <TimelineDetails
        model={model}
        selectedId={selectedId}
        onSelect={onSelect}
        hrefFor={hrefFor}
        routeBase={routeBase}
      />
    </MemoryRouter>,
  );
  return { onSelect };
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

  it('links a pre-Track document as a file download, named in the link text', () => {
    const { model } = renderDetails(CERTIFIED_2002, 'document-doc-0');
    const document = model.items.find((item) => item.id === 'document-doc-0')!;

    const link = screen.getByRole('link', {
      name: `Open document: ${document.title}, ${dayDate(document.start)}`,
    });
    expect(link).toHaveAttribute('href', '/demi-search/documents/doc-0/download?redirect=1');
    expect(screen.queryByText('Decision')).not.toBeInTheDocument();
  });

  it('opens a pre-Track PDF inline in a new tab', () => {
    renderModel(
      buildTimelineModel({
        project: CERTIFIED_2002,
        documents: [{ ...AMENDMENT_DOCUMENTS[0], documentFileName: 'package.pdf' }],
        lists: [],
        today: TODAY,
      }),
      'document-doc-0',
    );

    const link = screen.getByRole('link', { name: /^Open document/ });
    expect(link).toHaveAttribute('href', '/demi-search/documents/doc-0/download?inline=1');
    expect(link).toHaveAttribute('target', '_blank');
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

  it.each([
    ['a page of the project through the router', '/p/proj-1/documents/amendments', true],
    ['a file as a plain link', '/demi-search/documents/doc-0/download?redirect=1', false],
    ['another site as a plain link', 'https://example.com/doc.pdf', false],
  ])('opens %s', async (_what, href, routed) => {
    renderDetails(CEDAR, 'work-102', () => href, '/p/proj-1');
    const link = () => screen.getByRole('link', { name: /^Amendment documents for this project/ });
    // Runs after the router's own handler, and stops jsdom from trying to navigate.
    let prevented: boolean | undefined;
    const after = (event: Event) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', after);

    await userEvent.setup().click(link());
    window.removeEventListener('click', after);

    expect(link()).toHaveAttribute('href', href);
    expect(prevented).toBe(routed);
  });

  it('draws no link to an unsafe address', () => {
    renderDetails(CEDAR, 'work-102', () => 'javascript:alert(1)');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('draws no link when the tab gives none', () => {
    renderDetails(CEDAR, 'work-102');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says an Act only Track names comes after the ones Eagle lists', () => {
    renderModel(ajax(), 'band-2018');

    expect(fields()['On this project']).toBe('Later Act, not listed in Eagle');
  });

  it('lists only the Act’s own milestones under an earlier Act’s history, not comment periods', () => {
    const project = {
      ...TRANSITIONED,
      legislation_2002: {
        ...(TRANSITIONED['legislation_2002'] as object),
        decisionDate: '2015-06-01T07:00:00.000Z',
      },
    };
    renderModel(
      buildTimelineModel({
        project,
        documents: [],
        lists: [],
        commentPeriods: [{ ...AJAX_COMMENT_PERIODS[1], start: '2016-01-04T08:00:00.000Z' }],
        today: TODAY,
      }),
      'history-2002',
    );

    const dated = screen.getByRole('region', { name: 'Dated milestones' });
    expect(
      within(dated)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Decision date']);
  });

  it('names the first assessment on the second assessment’s branch start', () => {
    renderDetails(SECOND_ASSESSMENT, 'branch-104');

    expect(fields()['First assessment']).toMatch(/^Assessment terminated, \d+ \w{3} \d{4}$/);
  });
});

/** Ajax with its phase documents; `phase-1` is a Track phase no document is tagged with. */
function ajax(more: Partial<TimelineInput> = {}) {
  return buildTimelineModel({
    project: AJAX,
    documents: [],
    lists: AJAX_LISTS,
    projectDocuments: AJAX_PHASE_DOCUMENTS,
    today: TODAY,
    ...more,
  });
}

const without = (name: string) =>
  AJAX_PHASE_DOCUMENTS.filter((document) => !document.phase?.endsWith(`-${name}`));
const documentsRegion = () => screen.getByRole('region', { name: 'Documents' });
const viewAll = () => within(documentsRegion()).getByRole('link', { name: /^View all/ });

describe('TimelineDetails documents', () => {
  it('lists the newest 50 of a phase’s documents', () => {
    renderModel(ajax(), 'phase-2002-application-review', undefined, '/p/ajax');

    const listed = within(documentsRegion()).getAllByRole('link', {
      name: /^Application Review document/,
    });
    expect(listed).toHaveLength(50);
    expect(listed[0]).toHaveTextContent('Application Review document 526');
  });

  it('links to all of a phase’s documents by its tag, once', () => {
    renderModel(ajax(), 'phase-2002-application-review', undefined, '/p/ajax');

    expect(viewAll()).toHaveAccessibleName(/^View all 534 documents: Application Review, /);
    expect(viewAll()).toHaveAttribute(
      'href',
      '/p/ajax/documents?projectPhase=projectPhase-2002-Application+Review',
    );
    expect(screen.queryByRole('link', { name: /^Documents for this phase/ })).toBeNull();
  });

  it('gives no count when the read stopped short of the project’s documents', () => {
    renderModel(
      ajax({ projectDocumentTotal: 3000 }),
      'phase-2002-application-review',
      undefined,
      '/p/ajax',
    );

    expect(viewAll()).toHaveAccessibleName(/^View all documents: /);
  });

  it('gives no count when a document of the same tag was dropped, as the tag page lists it', () => {
    const early = phaseDocuments(2002, 'Pre-Application', 3, '2001-01-08', '2001-06-01');
    renderModel(
      ajax({ projectDocuments: [...AJAX_PHASE_DOCUMENTS, ...early] }),
      'phase-2002-pre-application',
      undefined,
      '/p/ajax',
    );

    expect(viewAll()).toHaveAccessibleName(/^View all documents: /);
  });

  it('gives no count when another phase row lists other documents of the same tag', () => {
    // Pre-EA documents before the recorded move date the 1996 row, the rest the 2002 row.
    const model = buildTimelineModel({
      project: {
        name: 'Moved from the 1996 Act',
        legislation: '2002 Environmental Assessment Act',
        legislationYearList: [1996, 2002],
        currentLegislationYear: 'legislation_2002',
        legislationTransitions: [{ fromYear: 1996, toYear: 2002, date: '2005-01-10' }],
      },
      documents: [],
      lists: AJAX_LISTS,
      projectDocuments: [
        ...phaseDocuments(2002, 'Pre-EA', 60, '2003-06-02', '2004-06-01'),
        ...phaseDocuments(2002, 'Pre-EA', 60, '2006-01-09', '2007-01-08'),
      ],
      today: TODAY,
    });
    renderModel(model, 'phase-2002-pre-ea', undefined, '/p/moved');

    expect(viewAll()).toHaveAccessibleName(/^View all documents: /);
  });

  it('keeps the count when the decision lists the same documents as its phase', () => {
    const referral = phaseDocuments(2002, 'Referral', 60, '2017-02-23', '2017-12-14');
    renderModel(
      ajax({ projectDocuments: [...without('Referral'), ...referral] }),
      'phase-2002-referral',
      undefined,
      '/p/ajax',
    );

    expect(viewAll()).toHaveAccessibleName(/^View all 60 documents: /);
  });

  it('links a decision to the certificates tab, with no count', () => {
    const decision = phaseDocuments(2002, 'Referral', 60, '2017-12-01', '2017-12-13').map(
      (document, i) => ({ ...document, _id: `decision-${i}`, type: 'decision-materials' }),
    );
    renderModel(
      ajax({
        lists: [
          ...AJAX_LISTS,
          { id: 'decision-materials', name: 'Decision Materials', legislation: 2002 },
        ],
        projectDocuments: [...AJAX_PHASE_DOCUMENTS, ...decision],
      }),
      'certificate',
      undefined,
      '/p/ajax',
    );

    expect(viewAll()).toHaveAccessibleName(/^View all documents: /);
    expect(viewAll()).toHaveAttribute('href', '/p/ajax/documents/certificates');
  });

  it('links a comment period’s documents to its own page, once', () => {
    const period = {
      ...AJAX_COMMENT_PERIODS[0],
      relatedDocuments: AJAX_PHASE_DOCUMENTS.slice(300, 360).map((document) => document._id),
    };
    renderModel(ajax({ commentPeriods: [period] }), 'comment-period-cp-1', undefined, '/p/ajax');

    expect(viewAll()).toHaveAccessibleName(/^View all 60 documents: /);
    expect(viewAll()).toHaveAttribute('href', '/p/ajax/cp/cp-1/details');
    expect(screen.queryByRole('link', { name: /^Comment period details/ })).toBeNull();
  });

  it('draws no View all link under 50 documents', () => {
    renderModel(ajax(), 'phase-2002-pre-ea', undefined, '/p/ajax');

    expect(within(documentsRegion()).queryByRole('link', { name: /^View all/ })).toBeNull();
  });

  it.each([
    ['all were read', {}, 'None'],
    ['the read stopped short', { projectDocumentTotal: 3000 }, 'None among the documents read'],
    ['the read failed', { projectDocumentsFailed: true }, 'Could not be read'],
  ])('says a phase with no documents has none when %s', (_when, more, value) => {
    renderModel(ajax(more), 'phase-1');

    expect(fields()['Documents']).toBe(value);
  });
});

describe('TimelineDetails comment periods', () => {
  it('gives a comment period its name, dates, source and page', () => {
    renderModel(
      ajax({ commentPeriods: AJAX_COMMENT_PERIODS }),
      'comment-period-cp-1',
      undefined,
      '/p/ajax',
    );

    expect(fields()).toMatchObject({
      Name: 'Application Review',
      Dates: '26 Jan 2016 – 11 Apr 2016',
      Source: 'Comment period record',
    });
    expect(screen.getByRole('link', { name: /^Comment period details/ })).toHaveAttribute(
      'href',
      '/p/ajax/cp/cp-1/details',
    );
  });

  const failedReads = [
    ['commentPeriodsFailed', 'Comment periods'],
    ['amendmentsFailed', 'Amendment documents'],
  ];

  it.each(failedReads)('says on Today when %s', (flag, term) => {
    renderModel(ajax({ [flag]: true }), null);

    expect(fields()[term]).toBe('Could not be read');
  });

  it.each(failedReads)('says nothing on another row when %s', (flag, term) => {
    renderModel(ajax({ [flag]: true }), 'certificate');

    expect(fields()).not.toHaveProperty(term);
  });
});
