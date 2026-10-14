import { describe, it, expect, beforeAll } from 'vitest';
import { searchPage } from 'app/api/unified-search';
import { LEGACY_FILTERS } from 'app/routes/legacy-search';
import { capturedRequestUrl } from '../../../../test-utils';
import { toNativeFilters } from '../search-filters';
import { projectsConfig } from './projects';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
  proponent: 'Cedar LNG Partners LP',
  type: 'Mines',
  region: 'Skeena',
  currentPhaseName: 'phase-1',
  decisionDateStart: '2019-01-01',
  decisionDateEnd: '2019-12-31',
  eacDecision: 'decision-1',
  CEAAInvolvement: 'ceaa-1',
};

/** The name `/projects` takes each filter under (eagle-demi `projectsKind`). */
const NATIVE: Record<string, string> = {
  proponent: 'proponentName',
  type: 'projectType',
  region: 'region',
  currentPhaseName: 'currentPhaseName',
  decisionDateStart: 'decisionDateStart',
  decisionDateEnd: 'decisionDateEnd',
  eacDecision: 'eacDecision',
  CEAAInvolvement: 'CEAAInvolvement',
};

const ADVANCED_IDS = projectsConfig.advancedFields.map((field) => field.id);

/** Filter ids the columns offer in the filter row, in column order. */
const COLUMN_FILTER_IDS = projectsConfig.columns
  .filter((column) => column.filter)
  .map((column) => column.filterId ?? column.key);

/** The query the tab sends for that state. */
let requested: URLSearchParams;

beforeAll(async () => {
  const url = await capturedRequestUrl(() =>
    searchPage(projectsConfig.kind, {
      page: 1,
      pageSize: 25,
      q: 'lng',
      filters: toNativeFilters(FILLED, [], projectsConfig.wire),
    }),
  );
  requested = new URL(url, 'http://localhost').searchParams;
});

describe('projects record type', () => {
  it('reads /projects, in name order', () => {
    expect(projectsConfig.kind).toBe('projects');
    expect(projectsConfig.defaultSort).toBe('+name');
  });

  it('sorts only by name, the one sort /projects takes', () => {
    const sortable = projectsConfig.columns.filter((column) => column.sortable !== false);

    expect(sortable.map((column) => column.key)).toEqual(['name']);
  });

  it('offers the column filters /projects takes', () => {
    expect(COLUMN_FILTER_IDS).toEqual(['proponent', 'type', 'region', 'currentPhaseName']);
  });

  it('offers the decision, involvement and decision date range as advanced fields', () => {
    expect(ADVANCED_IDS).toEqual([
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

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED).sort()).toEqual([...COLUMN_FILTER_IDS, ...ADVANCED_IDS].sort());
  });

  it.each(Object.keys(FILLED))('sends %s under the name /projects takes', (id) => {
    expect(requested.get(NATIVE[id] ?? '')).toBe(FILLED[id]);
  });

  it('sends the keyword as q', () => {
    expect(requested.get('q')).toBe('lng');
  });

  it('shows the last updated date without a filter, which /projects does not take', () => {
    const updated = projectsConfig.columns.find((column) => column.key === 'dateUpdated');

    expect(updated).toMatchObject({ date: true });
    expect(updated?.filter).toBeUndefined();
  });

  it('names both ends of every date range as the range they bound', () => {
    expect(
      projectsConfig.advancedFields
        .filter((field) => field.kind === 'date')
        .map((field) => field.label),
    ).toEqual(['Decision from', 'Decision to']);
  });

  it('columns lead with a locked link to the project', () => {
    expect(projectsConfig.columns.map((column) => column.label)).toEqual([
      'Project',
      'Last updated',
      'Proponent',
      'Type',
      'Sub-type',
      'Region',
      'Phase',
    ]);
    expect(projectsConfig.columns[0]).toMatchObject({ link: true, locked: true });
  });

  it('gives every column a width', () => {
    const unsized = projectsConfig.columns.filter((column) => !column.width);

    expect(unsized.map((column) => column.label)).toEqual([]);
  });

  it('fills the table exactly when every column is on', () => {
    const total = projectsConfig.columns.reduce(
      (sum, column) => sum + Number.parseFloat(column.width ?? '0'),
      0,
    );

    expect(total).toBe(100);
  });

  it('fills the column dropdowns from the lists and the proponent orgs', () => {
    const options = projectsConfig.optionsFrom(
      [
        { id: 'phase-1', name: 'Pre-application', type: 'projectPhase' },
        { id: 'decision-1', name: 'Certificate issued', type: 'eaDecisions' },
        { id: 'ceaa-1', name: 'Substituted', type: 'ceaaInvolvements' },
      ],
      [{ id: 'org-1', name: 'Cedar LNG Partners LP' }],
    );

    // `/projects` filters by the proponent's name.
    expect(options['proponent']).toEqual([
      { value: 'Cedar LNG Partners LP', label: 'Cedar LNG Partners LP' },
    ]);
    expect(options['currentPhaseName']).toEqual([{ value: 'phase-1', label: 'Pre-application' }]);
    expect(options['eacDecision']).toEqual([{ value: 'decision-1', label: 'Certificate issued' }]);
    expect(options['CEAAInvolvement']).toEqual([{ value: 'ceaa-1', label: 'Substituted' }]);
  });

  it('offers two proponents of one name as one pick, since the name is what /projects takes', () => {
    const options = projectsConfig.optionsFrom(
      [],
      [
        { id: 'org-1', name: 'Coast Aggregates' },
        { id: 'org-2', name: 'Coast Aggregates' },
      ],
    );

    expect(options['proponent']).toEqual([
      { value: 'Coast Aggregates', label: 'Coast Aggregates' },
    ]);
  });

  it('keeps a phase both Acts name as two options, each with its Act', () => {
    const options = projectsConfig.optionsFrom(
      [
        { id: 'pre-2002', name: 'Pre-Application', type: 'projectPhase', legislation: 2002 },
        { id: 'pre-2018', name: 'Pre-Application', type: 'projectPhase', legislation: 2018 },
      ],
      [],
    );

    expect(options['currentPhaseName']).toEqual([
      { value: 'pre-2002', label: 'Pre-Application', legislation: '2002' },
      { value: 'pre-2018', label: 'Pre-Application', legislation: '2018' },
    ]);
  });

  it('shows the sub-type, off until the reader turns it on, with no filter /projects takes', () => {
    const subType = projectsConfig.columns.find((column) => column.label === 'Sub-type');

    expect(subType).toMatchObject({ key: 'sector', defaultHidden: true });
    expect(subType?.filter).toBeUndefined();
  });

  it('reads the proponent and type DEMI carries on the project', () => {
    const keys = projectsConfig.columns.map((column) => column.key);

    expect(keys).toEqual(expect.arrayContaining(['proponentName', 'projectType']));
  });
});

describe('projects record link', () => {
  const nameColumn = projectsConfig.columns.find((column) => column.link);

  it('points the project name at the project page', () => {
    // DEMI's own `id` is the Track id; the app routes by the Eagle id.
    expect(nameColumn?.href?.({ id: '154', eagleId: 'proj-1', name: 'Cedar LNG' })).toBe(
      '/p/proj-1',
    );
  });

  it('keeps the target in the app, so the name routes rather than reloads', () => {
    expect(nameColumn?.hrefExternal).toBeFalsy();
  });

  it('leaves a project with no id unlinked', () => {
    expect(nameColumn?.href?.({ name: 'Cedar LNG' })).toBeUndefined();
  });
});
