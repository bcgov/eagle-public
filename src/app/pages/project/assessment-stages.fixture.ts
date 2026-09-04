import type { Project } from 'app/models/project';
import type { PhaseListItem } from './assessment-stages';

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
