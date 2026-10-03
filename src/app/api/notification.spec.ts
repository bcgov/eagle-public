import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from 'app/config/config';
import { ProjectNotification } from 'app/models/projectNotification';
import { getNotificationById, inlineCommentPeriod, notificationToProject } from './notification';

/** A Mongo ObjectId, the only id shape the lookup sends. */
const ID = '5c8a3a3ce7f1f1002466c2b1';

/** A stored notification as `dataset=ProjectNotification` answers it. */
const ROW = {
  _id: ID,
  name: 'Bear Creek Aggregate',
  description: 'Expansion of a gravel pit.',
  type: 'Mines',
  subType: 'Sand and Gravel',
  nature: 'Modification of Existing',
  region: 'Cariboo',
  location: 'Near Quesnel',
  proponent: 'Acme Aggregates Ltd.',
  decision: 'Referred to IAAC',
  decisionDate: '2025-06-01T12:00:00.000Z',
  trigger: 'Greenfield,Expansion',
  notificationReceivedDate: '2025-03-14T12:00:00.000Z',
  notificationThresholdValue: 50,
  notificationThresholdUnits: 'hectares',
  associatedProjectId: 'p-9',
  associatedProjectName: 'Bear Creek Mine',
  // Stored `[lat, lon]`, the reverse of a project.
  centroid: [52.98, -122.49],
  pcp: 'open',
  isMet: true,
  metURL: 'https://engage.gov.bc.ca/bear-creek',
  dateStarted: '2025-04-01T19:00:00.000Z',
  dateCompleted: '2025-04-30T19:00:00.000Z',
};

function adapt(overrides: Record<string, unknown> = {}) {
  return notificationToProject(new ProjectNotification({ ...ROW, ...overrides }));
}

describe('notificationToProject', () => {
  it('turns the stored [lat, lon] centroid into the [lon, lat] a project map reads', () => {
    expect(adapt().centroid).toEqual([-122.49, 52.98]);
  });

  it('leaves the centroid empty when the notification has no pair', () => {
    expect(adapt({ centroid: [] }).centroid).toEqual([]);
    expect(adapt({ centroid: [52.98] }).centroid).toEqual([]);
  });

  it('reads the notification decision as the project decision', () => {
    expect(adapt().eacDecision).toEqual({ name: 'Referred to IAAC' });
  });

  it('has no decision when the notification has none', () => {
    expect(adapt({ decision: '' }).eacDecision).toBeUndefined();
  });

  it('wraps the proponent string in the object a project holds', () => {
    expect(adapt().proponent).toEqual({ name: 'Acme Aggregates Ltd.' });
  });

  it('reads the name off a populated proponent organization', () => {
    expect(adapt({ proponent: { _id: 'o-1', name: 'Acme Aggregates Ltd.' } }).proponent).toEqual({
      name: 'Acme Aggregates Ltd.',
    });
  });

  it('keeps the fields the project page reads under the same names', () => {
    const project = adapt();

    expect(project._id).toBe(ID);
    expect(project.name).toBe('Bear Creek Aggregate');
    expect(project.description).toBe('Expansion of a gravel pit.');
    expect(project.region).toBe('Cariboo');
    expect(project.location).toBe('Near Quesnel');
    expect(project.type).toBe('Mines');
    expect(project.sector).toBe('Sand and Gravel');
    expect(project.nature).toBe('Modification of Existing');
    expect(project.decisionDate).toBe('2025-06-01T12:00:00.000Z');
    expect(project.currentPhaseName).toEqual({ name: 'Project Notification' });
  });

  it('carries no comment period banner, so the shell does not look one up', () => {
    expect(adapt().commentPeriodForBanner).toBeNull();
  });

  it('keeps what only a notification has under `notification`', () => {
    const facts = adapt().notification;

    expect(facts?.trigger).toBe('Greenfield,Expansion');
    expect(facts?.notificationReceivedDate).toBe('2025-03-14T12:00:00.000Z');
    expect(facts?.notificationThresholdValue).toBe(50);
    expect(facts?.notificationThresholdUnits).toBe('hectares');
    expect(facts?.associatedProjectId).toBe('p-9');
    expect(facts?.pcp).toBe('open');
    expect(facts?.isMet).toBe(true);
    expect(facts?.metURL).toBe('https://engage.gov.bc.ca/bear-creek');
    expect(facts?.dateStarted?.toISOString()).toBe('2025-04-01T19:00:00.000Z');
    expect(facts?.dateCompleted?.toISOString()).toBe('2025-04-30T19:00:00.000Z');
  });

  it('reads an empty associated project as none, so no "View project" link is drawn', () => {
    expect(adapt({ associatedProjectId: '' }).notification?.associatedProjectId).toBeUndefined();
    expect(adapt({ associatedProjectId: null }).notification?.associatedProjectId).toBeUndefined();
  });

  it('drops null threshold and received date rather than printing them', () => {
    const facts = adapt({
      notificationThresholdValue: null,
      notificationThresholdUnits: null,
      notificationReceivedDate: null,
    }).notification;

    expect(facts?.notificationThresholdValue).toBeUndefined();
    expect(facts?.notificationThresholdUnits).toBeUndefined();
    expect(facts?.notificationReceivedDate).toBeUndefined();
  });
});

describe('inlineCommentPeriod', () => {
  const facts = (overrides: Record<string, unknown> = {}) => adapt(overrides).notification ?? {};

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has no period for a notification with no pcp', () => {
    expect(inlineCommentPeriod('pn-1', facts({ pcp: undefined }))).toBeNull();
  });

  it('has no period for pcp "none"', () => {
    expect(inlineCommentPeriod('pn-1', facts({ pcp: 'none' }))).toBeNull();
  });

  it('reads pcp "pending" as an upcoming period', () => {
    expect(inlineCommentPeriod('pn-1', facts({ pcp: 'pending' }))?.commentPeriodStatus).toBe(
      'Upcoming',
    );
  });

  it('reads pcp "closed" as a closed period', () => {
    expect(inlineCommentPeriod('pn-1', facts({ pcp: 'closed' }))?.commentPeriodStatus).toBe(
      'Closed',
    );
  });

  it('files the period under the notification and carries its ENGAGE link', () => {
    const period = inlineCommentPeriod('pn-1', facts());

    expect(period?._id).toBe('pn-1');
    expect(period?.project).toBe('pn-1');
    expect(period?.isMet).toBe(true);
    expect(period?.metURL).toBe('https://engage.gov.bc.ca/bear-creek');
  });

  it('trusts a stored "open" over dates that have passed, and says the period is active', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-06-15T19:00:00.000Z'));

    const period = inlineCommentPeriod('pn-1', facts());

    expect(period?.commentPeriodStatus).toBe('Open');
    expect(period?.daysRemaining).toBe('Active');
  });

  it('says the period is active when an open notification stores no dates', () => {
    const period = inlineCommentPeriod(
      'pn-1',
      facts({ dateStarted: undefined, dateCompleted: undefined }),
    );

    expect(period?.commentPeriodStatus).toBe('Open');
    expect(period?.daysRemaining).toBe('Active');
  });

  it('keeps the days left when the stored dates bracket today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-04-25T19:00:00.000Z'));

    const period = inlineCommentPeriod('pn-1', facts());

    expect(period?.daysRemaining).toBe('5 Days Remaining');
  });
});

describe('getNotificationById', () => {
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  function respondWith(rows: unknown[]): void {
    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([{ searchResults: rows, meta: [{ searchResultsTotal: rows.length }] }]),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
  }

  beforeEach(async () => {
    window.__env = { logLevel: 4, SEARCH_API_PATH: '/demi-search' };
    await loadConfig();
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
  });

  it('asks for one ProjectNotification, filtered by id under and[]', async () => {
    respondWith([ROW]);

    await getNotificationById(ID);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/demi-search/search?dataset=ProjectNotification');
    expect(url).toContain(`&and[_id]=${ID}`);
    // A bare `_id` is not a filter: it answers the whole collection, first row wins.
    expect(url).not.toContain(`&_id=${ID}`);
    expect(url).toContain('&pageSize=1');
  });

  it('answers the matching row as a project record', async () => {
    respondWith([ROW]);

    const project = await getNotificationById(ID);

    expect(project?.name).toBe('Bear Creek Aggregate');
    expect(project?.centroid).toEqual([-122.49, 52.98]);
    expect(project?.notification?.associatedProjectId).toBe('p-9');
  });

  it('answers null when no notification has the id', async () => {
    respondWith([]);

    expect(await getNotificationById(ID)).toBeNull();
  });

  it('answers null for a row whose id is not the one asked for', async () => {
    // A backend that ignores the filter answers the first row of the collection.
    respondWith([{ ...ROW, _id: '5c8a3a3ce7f1f1002466c2b2' }]);

    expect(await getNotificationById(ID)).toBeNull();
  });

  it.each([
    ['a slug', 'pn-1'],
    ['two ids joined by a comma', `${ID},5c8a3a3ce7f1f1002466c2b2`],
    ['23 hex digits', ID.slice(1)],
    ['a non-hex letter', `${ID.slice(1)}g`],
    // The point read is case-sensitive, so an upper-case id would never match.
    ['an upper-case hex id', ID.toUpperCase()],
  ])('answers null for %s without asking the backend', async (_label, id) => {
    respondWith([ROW]);

    expect(await getNotificationById(id)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the search backend fails, so the page can say so', async () => {
    fetchMock = vi.fn(async () => new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNotificationById(ID)).rejects.toThrow();
  });
});
