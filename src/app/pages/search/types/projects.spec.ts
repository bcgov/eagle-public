import { describe, it, expect, beforeAll } from 'vitest';
import { parseGridParams } from 'app/components/display-grid/use-grid-url-state';
import { LEGACY_FILTERS } from 'app/routes/legacy-search';
import { toNativeFilters } from '../search-filters';
import { nativeQueryFor } from './native-query.spec-helper';
import { projectsConfig } from './projects';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
  nameContains: 'lng',
  sector: 'Mineral Mines',
  dateUpdatedStart: '2024-01-01',
  dateUpdatedEnd: '2024-06-30',
  proponent: 'org-1',
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
  nameContains: 'nameContains',
  sector: 'sector',
  dateUpdatedStart: 'dateUpdatedStart',
  dateUpdatedEnd: 'dateUpdatedEnd',
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

/** The year column, which sends the range its year stands for rather than a value of its own. */
const YEAR_ID = 'dateUpdated';

/** The query the tab sends for that state. */
let requested: URLSearchParams;

beforeAll(async () => {
  requested = await nativeQueryFor(
    projectsConfig,
    { record: 'projects', keywords: 'lng', ...FILLED },
    { orgs: [{ id: 'org-1', name: 'Cedar LNG Partners LP' }] },
  );
});

describe('projects record type', () => {
  it('reads /projects, in name order', () => {
    expect(projectsConfig.kind).toBe('projects');
    expect(projectsConfig.defaultSort).toBe('+name');
  });

  it('sorts by every column', () => {
    const unsorted = projectsConfig.columns.filter((column) => column.sortable === false);

    expect(unsorted.map((column) => column.key)).toEqual([]);
  });

  it('marks the last updated date sortable, so the phone sort select offers newest and oldest', () => {
    const updated = projectsConfig.columns.find((column) => column.key === 'dateUpdated');

    expect(updated).toMatchObject({ primaryDate: true, sortable: true });
  });

  it('sorts the phase by its name, the field /projects sorts the nested phase by', async () => {
    const phase = projectsConfig.columns.find((column) => column.key === 'currentPhaseName');
    const query = await nativeQueryFor(projectsConfig, 'record=projects', {
      sort: phase?.sortKey,
    });

    expect(query.get('sort')).toBe('currentPhaseName.name');
  });

  it('offers the column filters /projects takes', () => {
    expect(COLUMN_FILTER_IDS).toEqual([
      'nameContains',
      YEAR_ID,
      'proponent',
      'type',
      'sector',
      'region',
      'currentPhaseName',
    ]);
  });

  it('offers the updated and decision date ranges, decision and involvement as advanced fields', () => {
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

  it('covers every offered filter with a filled value', () => {
    const offered = [...COLUMN_FILTER_IDS, ...ADVANCED_IDS].filter((id) => id !== YEAR_ID);

    expect(Object.keys(FILLED).sort()).toEqual(offered.sort());
  });

  it('sends the name, sub-type and updated year an old address holds under their native names', async () => {
    const query = await nativeQueryFor(
      projectsConfig,
      'record=projects&nameContains=lng&sector=Mineral%20Mines&dateUpdated=2024',
    );

    expect(query.get('nameContains')).toBe('lng');
    expect(query.getAll('sector')).toEqual(['Mineral Mines']);
    expect(query.get('dateUpdatedStart')).toBe('2024-01-01');
    expect(query.get('dateUpdatedEnd')).toBe('2024-12-31');
  });

  it('sends two sub-types as a repeated sector, which /projects reads as either', async () => {
    const query = await nativeQueryFor(
      projectsConfig,
      'record=projects&sector=Mineral%20Mines,Energy-Electricity',
    );

    expect(query.getAll('sector')).toEqual(['Mineral Mines', 'Energy-Electricity']);
  });

  it.each(Object.keys(FILLED).filter((id) => id !== 'proponent'))(
    'sends %s under the name /projects takes',
    (id) => {
      expect(requested.get(NATIVE[id] ?? '')).toBe(FILLED[id]);
    },
  );

  it('sends the proponent picked by id as the name /projects filters by', () => {
    expect(requested.getAll('proponentName')).toEqual(['Cedar LNG Partners LP']);
  });

  it('sends a proponent whose name carries commas as one name, after a trip through the URL', () => {
    const name = "Nisga'a Nation, Rockies LNG Limited Partnership and Western LNG LLC";
    const { filters } = parseGridParams(
      new URLSearchParams(`record=projects&proponent=org-9&region=Skeena,Northeast`),
    );
    const native = toNativeFilters(
      filters,
      [],
      projectsConfig.wire,
      projectsConfig.wireLabels?.([{ id: 'org-9', name }]),
    );

    expect(native['proponentName']).toBe(name);
    // A multi-select still splits on its comma.
    expect(native['region']).toEqual(['Skeena', 'Northeast']);
  });

  it('sends the keyword as q', () => {
    expect(requested.get('q')).toBe('lng');
  });

  it('names both ends of every date range as the range they bound', () => {
    expect(
      projectsConfig.advancedFields
        .filter((field) => field.kind === 'date')
        .map((field) => field.label),
    ).toEqual(['Updated from', 'Updated to', 'Decision from', 'Decision to']);
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

    // Keyed by id, since a name can carry the comma the URL splits picks on.
    expect(options['proponent']).toEqual([{ value: 'org-1', label: 'Cedar LNG Partners LP' }]);
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

    expect(options['proponent']).toEqual([{ value: 'org-1', label: 'Coast Aggregates' }]);
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

  it('shows the sub-type off until the reader turns it on, filtered by sector', () => {
    const subType = projectsConfig.columns.find((column) => column.label === 'Sub-type');

    expect(subType).toMatchObject({
      key: 'sector',
      defaultHidden: true,
      filter: 'values',
      filterId: 'sector',
    });
  });

  it('fills the sub-type menu from the sectors the rows hold, trimmed and once each', () => {
    const options = projectsConfig.optionsFromRows?.([
      { sector: 'Mineral Mines ' },
      { sector: 'Energy-Electricity' },
      { sector: 'Mineral Mines' },
    ]);

    expect(options?.['sector']).toEqual([
      { value: 'Energy-Electricity', label: 'Energy-Electricity' },
      { value: 'Mineral Mines', label: 'Mineral Mines' },
    ]);
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
