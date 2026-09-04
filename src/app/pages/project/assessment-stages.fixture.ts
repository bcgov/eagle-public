import type { Project } from 'app/models/project';
import type { PhaseListItem } from './assessment-stages';

/** `projectPhase` list rows and matching projects, shared by the rail's two specs. */

const PHASES_2018 = [
  'Early Engagement',
  'EA Readiness Decision',
  'Process Planning',
  'Application Development & Review',
  'Effects Assessment',
  'Referral',
  'Post Decision',
  'Post Decision - Pre-Construction',
  'Post Decision - Construction',
  'Post Decision - Operation',
  'Post Decision - Care & Maintenance',
  'Post Decision - Decommission',
  'Complete',
  'Post Decision - Amendment',
  'Post Decision - Substantial Start',
  'Post Decision - Suspension',
  'Other',
];

const PHASES_2002 = [
  'Pre-Application',
  'Application Review',
  'Referral',
  'Post Decision - Construction',
  'Complete',
  'Other',
];

function rows(names: string[], legislation: string): PhaseListItem[] {
  return names.map((name, index) => ({
    _id: `${legislation}-${index + 1}`,
    type: 'projectPhase',
    name,
    listOrder: index + 1,
    legislation,
  }));
}

export const LISTS: PhaseListItem[] = [
  ...rows(PHASES_2018, '2018'),
  ...rows(PHASES_2002, '2002'),
  {
    _id: 'doctype-1',
    type: 'doctype',
    name: 'Early Engagement',
    listOrder: 1,
    legislation: '2018',
  },
];

export function phaseRow(name: string, act = '2018'): PhaseListItem {
  const row = LISTS.find(
    (item) => item.type === 'projectPhase' && item.name === name && item.legislation === act,
  );
  if (!row) throw new Error(`no ${act} projectPhase named ${name}`);
  return row;
}

export function makeProject(currentPhase: string | null, act = '2018'): Project {
  const row = currentPhase ? phaseRow(currentPhase, act) : null;
  return {
    _id: 'proj-1',
    name: 'Cedar Quarry',
    legislation: `${act} Environmental Assessment Act`,
    currentPhaseName: row && {
      _id: row._id,
      name: row.name,
      listOrder: row.listOrder,
      legislation: act,
    },
  } as unknown as Project;
}
