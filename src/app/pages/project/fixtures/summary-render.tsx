import { afterEach, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import { queryClient } from 'app/api/query-client';
import { loadConfig } from 'app/config/config';
import { Project } from 'app/models/project';
import { json, native } from '../../home/home-fetch.spec-helper';
import { renderAt } from '../../../../test-utils';
import { LISTS, phaseRow } from '../assessment-stages.fixture';
import type { PhaseListItem } from '../assessment-stages';
import { ProjectSummary } from '../project-summary';
import { TODAY } from '../timeline.fixture';

export const DEMI = '/demi-projects';
export const ACT_2002 = '2002 Environmental Assessment Act';
export const ACT_2018 = '2018 Environmental Assessment Act';
export const EAA_2002 = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/02043_01';
export const EAA_2018 = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/18051';

/** An Eagle phase reference with the id of its `List` row, so the rail can mark it current. */
export function eaglePhase(name: string, year = 2018) {
  const row = phaseRow(name, year);
  return { _id: row.id, name: row.name, legislation: row.legislation };
}

/** A period that opened last week and closes on November 4 in BC. */
export const OPEN_PERIOD = {
  id: 'cp-open',
  dateStarted: '2026-10-20T15:00:00.000Z',
  dateCompleted: '2026-11-04T20:00:00.000Z',
};
export const UPCOMING_PERIOD = {
  id: 'cp-next',
  dateStarted: '2026-11-16T16:00:00.000Z',
  dateCompleted: '2026-12-16T20:00:00.000Z',
};
export const CLOSED_PERIOD = {
  id: 'cp-done',
  dateStarted: '2026-05-01T15:00:00.000Z',
  dateCompleted: '2026-06-01T20:00:00.000Z',
};

/** Pins the clock to the fixtures' TODAY in BC; call once at the top of a spec file. */
export function pinSummaryClock() {
  const originalEnv = window.__env;

  beforeEach(async () => {
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: DEMI };
    await loadConfig();
    // The comment-period read looks the DEMI id up through the app's own cache.
    queryClient.clear();
    vi.stubEnv('TZ', 'America/Vancouver');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.__env = originalEnv;
  });
}

interface RenderOptions {
  /** The comment-period answer, or a promise the spec settles. */
  periods?: unknown[] | Promise<Response>;
  lists?: PhaseListItem[];
  listsLoading?: boolean;
  /** Rows DEMI's `/documents` answers. */
  documents?: unknown[];
  /** The DEMI project read's answer, in place of `doc`. */
  demi?: () => Promise<Response>;
}

/** Renders `doc`'s summary through the shell, every read answered from `doc` and `options`. */
export function renderSummary(
  doc: DemiProject,
  { periods = [], lists = LISTS, listsLoading = false, documents = [], demi }: RenderOptions = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith(`${DEMI}/`)) return demi ? demi() : json(doc);
      if (url.includes('/demi/api/comment-periods')) {
        return Array.isArray(periods) ? native(periods) : periods;
      }
      if (url.includes('/demi/api/documents')) return native(documents);
      return native([]);
    }),
  );
  const projId = doc.eagleId!;
  return renderAt(`/p/${projId}/overview`, [
    {
      path: '/p/:projId/overview',
      element: (
        <ProjectSummary
          project={Project.fromNative(doc)}
          projId={projId}
          lists={lists}
          listsLoading={listsLoading}
        />
      ),
    },
  ]);
}

/** Every URL fetched so far. */
export const requestedUrls = () => vi.mocked(fetch).mock.calls.map(([input]) => String(input));

export const summary = () => screen.getByRole('region', { name: 'Project status' });
export const findHeading = (name: string) =>
  within(summary()).findByRole('heading', { level: 2, name });
export const headings = () =>
  within(summary())
    .queryAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
export const term = (label: string) => within(summary()).queryByText(label, { selector: 'dt' });
/** The `dd` beside a fact's label. */
export const value = (label: string) =>
  within(summary()).getByText(label, { selector: 'dt' }).nextElementSibling;
/** A link whose name starts with `label`; the rest is the new-tab hint. */
export const linkNamed = (label: string) =>
  within(summary()).queryByRole('link', { name: new RegExp(`^${label}`) });
export const rail = (name: string) => within(summary()).getByRole('region', { name });
/** The stage a rail marks current. */
export const currentStage = (name: string) =>
  within(rail(name)).queryByRole('listitem', { current: 'step' });
