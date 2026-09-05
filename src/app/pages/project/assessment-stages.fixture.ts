import type { Phase } from 'app/api/project-phases';
import type { Project } from 'app/models/project';
import type { PhaseListItem } from './assessment-stages';

/**
 * Track work phases as DEMI mirrors them onto a project, under Track's own names — `&`, `/` and
 * `Proponent Time:` all differ from the rail's wording. This project is mid Effects Assessment,
 * so that phase is still open.
 */
export const PHASES: Phase[] = [
  {
    name: 'Early Engagement',
    startDate: '2020-08-01T00:00:00.000Z',
    endDate: '2021-01-15T00:00:00.000Z',
  },
  {
    name: 'Proponent Time: Project Description',
    startDate: '2021-01-16T00:00:00.000Z',
    endDate: '2021-03-31T00:00:00.000Z',
  },
  {
    name: 'Readiness Decision',
    startDate: '2021-04-01T00:00:00.000Z',
    endDate: '2021-04-28T00:00:00.000Z',
  },
  {
    name: 'Process Planning',
    startDate: '2021-09-01T00:00:00.000Z',
    endDate: '2021-11-30T00:00:00.000Z',
  },
  {
    name: 'Proponent Time: Application Development',
    startDate: '2021-12-01T00:00:00.000Z',
    endDate: '2022-06-30T00:00:00.000Z',
  },
  {
    name: 'Application Development & Review',
    startDate: '2022-08-01T00:00:00.000Z',
    endDate: '2022-09-30T00:00:00.000Z',
  },
  {
    name: 'Proponent Time: Revised Application',
    startDate: '2022-10-01T00:00:00.000Z',
    endDate: '2022-12-31T00:00:00.000Z',
  },
  { name: 'Effects Assessment', startDate: '2023-02-01T00:00:00.000Z', endDate: null },
];

/** The live eagle-api `projectPhase` rows, shared by the rail's two specs. */

const PHASES_2018: [number, string][] = [
  [0, 'Project Designation'],
  [1, 'Early Engagement'],
  [2, 'Readiness Decision'],
  [3, 'Process Planning'],
  [4, 'Application Development and Review'],
  [5, 'Effects Assessment'],
  [6, 'Referral'],
  [7, 'Post Decision - Pre-Construction'],
  [8, 'Post Decision - Construction'],
  [9, 'Post Decision - Operation'],
  [10, 'Post Decision - Care & Maintenance'],
  [11, 'Post Decision - Decommission'],
  [12, 'Post Decision - Amendment'],
  [13, 'Post Decision - Substantial Start'],
  [14, 'Post Decision - Extension'],
  [15, 'Post Decision - Suspension'],
  [16, 'Complete'],
  [17, 'Other'],
  [19, 'Post Decision - Transfer of Certificate/Order'],
];

const PHASES_2002: [number, string][] = [
  [0, 'Pre-EA'],
  [1, 'Pre-Application'],
  [2, 'Evaluation'],
  [3, 'Application Review'],
  [4, 'Further Assessment'],
  [5, 'Referral'],
  [6, 'Termination'],
  [7, 'Withdrawal'],
  [8, 'Post Decision - Pre-Construction'],
  [9, 'Post Decision - Construction'],
  [10, 'Post Decision - Operation'],
  [11, 'Post Decision - Care & Maintenance'],
  [12, 'Post Decision - Decommission'],
  [13, 'Post Decision - Complete'],
  [14, 'Post Decision - Amendment'],
  [15, 'Post Decision - Extension'],
  [16, 'Post Decision - Substantial Start'],
  [17, 'Post Decision - Suspension'],
  [18, 'Other'],
];

function rows(phases: [number, string][], legislation: number): PhaseListItem[] {
  return phases.map(([listOrder, name]) => ({
    _id: `${legislation}-${listOrder}`,
    type: 'projectPhase',
    name,
    listOrder,
    legislation,
  }));
}

export const LISTS: PhaseListItem[] = [
  ...rows(PHASES_2018, 2018),
  ...rows(PHASES_2002, 2002),
  { _id: 'doctype-1', type: 'doctype', name: 'Early Engagement', listOrder: 1, legislation: 2018 },
];

export function phaseRow(name: string, phaseYear = 2018): PhaseListItem {
  const row = LISTS.find(
    (item) => item.type === 'projectPhase' && item.name === name && item.legislation === phaseYear,
  );
  if (!row) throw new Error(`no ${phaseYear} projectPhase named ${name}`);
  return row;
}

/**
 * `phaseYear` is the phase row's own legislation, `act` the project's. They differ on the
 * projects that sit in a 2018 phase under the 2002 Act.
 */
export function makeProject(phase: string | null, phaseYear = 2018, act = phaseYear): Project {
  const row = phase ? phaseRow(phase, phaseYear) : null;
  return {
    _id: 'proj-1',
    name: 'Cedar Quarry',
    legislation: `${act} Environmental Assessment Act`,
    currentPhaseName: row && {
      _id: row._id,
      name: row.name,
      listOrder: row.listOrder,
      legislation: row.legislation,
    },
  } as unknown as Project;
}
