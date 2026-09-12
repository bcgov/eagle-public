import { describe, it, expect, beforeAll } from 'vitest';
import { toApiFilters } from 'app/components/display-grid/use-grid-url-state';
import { fetchData, SearchParamObject } from 'app/api/search';
import { LEGACY_FILTERS } from 'app/routes/legacy-search';
import { capturedRequestUrl } from '../../../../test-utils';
import { projectsConfig, resolveSort, PROJECTS_FALLBACK_SORT, PROJECTS_SORT } from './projects';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
  proponent: 'org-1',
  type: 'Mines',
  region: 'Skeena',
  currentPhaseName: 'phase-1',
  dateUpdatedStart: '2020-01-01',
  dateUpdatedEnd: '2020-12-31',
  decisionDateStart: '2019-01-01',
  decisionDateEnd: '2019-12-31',
  eacDecision: 'decision-1',
  CEAAInvolvement: 'ceaa-1',
};

const ADVANCED_IDS = projectsConfig.advancedFields.map((field) => field.id);

/**
 * Filter ids the columns offer in the filter row, in column order. A year column is left out: its
 * value is a year standing for a range, so it reaches the API as two other ids.
 */
const COLUMN_FILTER_IDS = projectsConfig.columns
  .filter((column) => column.filter && column.filter !== 'year')
  .map((column) => column.filterId ?? column.key);

/** The URL the API layer issues for that state; the filters ride raw, not pre-wrapped. */
let requested: string;

beforeAll(async () => {
  requested = await capturedRequestUrl(() =>
    fetchData(
      new SearchParamObject(
        'projects',
        'lng',
        projectsConfig.dataset,
        [],
        1,
        25,
        projectsConfig.defaultSort,
        {},
        false,
        '',
        FILLED,
      ),
    ),
  );
});

describe('projects record type', () => {
  it('searches the Project dataset, newest first', () => {
    expect(projectsConfig.dataset).toBe('Project');
    expect(projectsConfig.defaultSort).toBe('-dateUpdated');
  });

  it('offers the four column filters the projects index carries', () => {
    // Legislation is absent on purpose: the projects index has no such field.
    expect(COLUMN_FILTER_IDS).toEqual(['proponent', 'type', 'region', 'currentPhaseName']);
  });

  it('filters the last updated column by year', () => {
    const updated = projectsConfig.columns.find((column) => column.key === 'dateUpdated');

    expect(updated).toMatchObject({ filter: 'year', date: true });
  });

  it('offers the decision, involvement and two date ranges as advanced fields', () => {
    expect(ADVANCED_IDS).toEqual([
      'dateUpdatedStart',
      'dateUpdatedEnd',
      'decisionDateStart',
      'decisionDateEnd',
      'eacDecision',
      'CEAAInvolvement',
    ]);
  });

  it('gives every filter the Angular project list carried a control of its own', () => {
    const controlled = [...COLUMN_FILTER_IDS, ...ADVANCED_IDS];

    expect(LEGACY_FILTERS.projects.filter((id) => !controlled.includes(id))).toEqual([]);
  });

  it('columns lead with a locked link to the project', () => {
    expect(projectsConfig.columns.map((column) => column.label)).toEqual([
      'Project',
      'Last updated',
      'Proponent',
      'Type',
      'Region',
      'Phase',
    ]);
    expect(projectsConfig.columns[0]).toMatchObject({ link: true, locked: true });
  });

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED)).toEqual([...COLUMN_FILTER_IDS, ...ADVANCED_IDS]);
  });

  it.each([...COLUMN_FILTER_IDS, ...ADVANCED_IDS])('names %s to the API as and[]', (id) => {
    expect(requested).toContain(`and[${id}]=${FILLED[id]}`);
  });

  it.each([...COLUMN_FILTER_IDS, ...ADVANCED_IDS])('wraps %s once for a URL', (id) => {
    expect(toApiFilters(FILLED)[`and[${id}]`]).toBe(FILLED[id]);
  });

  it('fills the column dropdowns from the lists and the proponent orgs', () => {
    const options = projectsConfig.optionsFrom(
      [
        { _id: 'phase-1', name: 'Pre-application', type: 'projectPhase' },
        { _id: 'decision-1', name: 'Certificate issued', type: 'eaDecisions' },
        { _id: 'ceaa-1', name: 'Substituted', type: 'ceaaInvolvements' },
      ],
      [{ _id: 'org-1', name: 'Cedar LNG Partners LP' }],
    );

    expect(options['proponent']).toEqual([{ value: 'org-1', label: 'Cedar LNG Partners LP' }]);
    expect(options['currentPhaseName']).toEqual([{ value: 'phase-1', label: 'Pre-application' }]);
    expect(options['eacDecision']).toEqual([{ value: 'decision-1', label: 'Certificate issued' }]);
    expect(options['CEAAInvolvement']).toEqual([{ value: 'ceaa-1', label: 'Substituted' }]);
  });

  it('reads a proponent that arrives populated', () => {
    const proponent = projectsConfig.columns.find((column) => column.key === 'proponent');

    expect(proponent?.render?.({ proponent: { name: 'Cedar LNG Partners LP' } })).toBe(
      'Cedar LNG Partners LP',
    );
  });
});

describe('resolveSort', () => {
  it('sorts by last updated when the backend kept the field', () => {
    expect(resolveSort([{ searchResultsTotal: 3, dropped: [] }])).toBe(PROJECTS_SORT);
  });

  it('falls back to name order when the backend dropped dateUpdated', () => {
    expect(resolveSort([{ searchResultsTotal: 3, dropped: ['dateUpdated'] }])).toBe(
      PROJECTS_FALLBACK_SORT,
    );
  });

  it('sorts by last updated when there is no meta to read', () => {
    expect(resolveSort()).toBe(PROJECTS_SORT);
  });
});

describe('projects record link', () => {
  const nameColumn = projectsConfig.columns.find((column) => column.link);

  it('points the project name at the project page', () => {
    expect(nameColumn?.href?.({ _id: 'proj-1', name: 'Cedar LNG' })).toBe('/p/proj-1');
  });

  it('keeps the target in the app, so the name routes rather than reloads', () => {
    expect(nameColumn?.hrefExternal).toBeFalsy();
  });

  it('leaves a project with no id unlinked', () => {
    expect(nameColumn?.href?.({ name: 'Cedar LNG' })).toBeUndefined();
  });
});
