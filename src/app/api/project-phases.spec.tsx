import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { loadConfig } from 'app/config/config';
import { logger } from 'app/config/logging';
import { makeQueryClient } from '../../test-utils';
import {
  phasesOf,
  worksOf,
  useDemiProject,
  useProjectEaCertificate,
  useProjectPhases,
} from './project-phases';

const DEMI = '/demi-projects';

const MILESTONE = {
  name: 'Readiness Decision',
  position: 'END',
  eventType: 22,
  actualDate: '2021-03-01T08:00:00.000Z',
  anticipatedDate: '2021-02-15',
  outcome: 'Proceed to Process Planning',
  numberOfDays: 0,
};

const WORK = {
  trackWorkId: 12,
  workTypeId: 6,
  workType: 'Assessment',
  title: 'Cedar LNG Assessment',
  eaAct: '2018 Environmental Assessment Act',
  startDate: '2020-08-01T07:00:00.000Z',
  isActive: true,
  workState: 'IN_PROGRESS',
  decisionDate: null,
  anticipatedDecisionDate: '2023-12-01',
  outcome: null,
  phases: [
    {
      name: 'Early Engagement',
      startDate: '2020-08-01',
      endDate: '2021-03-01',
      isCompleted: true,
      eaActName: '2018 Environmental Assessment Act',
      sortOrder: 1,
    },
  ],
  milestones: [MILESTONE],
};
const original = window.__env;

let fetchMock: ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

async function setup(demiProjectsPath: string): Promise<void> {
  window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: demiProjectsPath };
  await loadConfig();
}

beforeEach(() => {
  fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          phases: [{ name: 'Early Engagement', startDate: '2020-08-01', endDate: null }],
          works: [WORK],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  window.__env = original;
  vi.unstubAllGlobals();
});

describe('useProjectPhases', () => {
  it('asks DEMI for the project and returns its phases', async () => {
    await setup(DEMI);
    const { result } = renderHook(() => useProjectPhases('proj-1'), { wrapper });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(fetchMock.mock.calls[0][0]).toBe('/demi-projects/proj-1');
    expect(result.current).toEqual([
      { name: 'Early Engagement', startDate: '2020-08-01', endDate: null },
    ]);
  });

  it('asks for nothing without a project id', async () => {
    await setup(DEMI);
    renderHook(() => useProjectPhases(''), { wrapper });

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});

describe('useDemiProject', () => {
  it('exposes the raw document, including shortUrl, so other fields can share the fetch', async () => {
    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            phases: [{ name: 'Early Engagement', startDate: '2020-08-01', endDate: null }],
            shortUrl: 'https://projects.eao.gov.bc.ca/s/abcd2345',
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await setup(DEMI);
    const { result } = renderHook(() => useDemiProject('proj-1'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.shortUrl).toBe('https://projects.eao.gov.bc.ca/s/abcd2345');
  });
});

describe('useProjectEaCertificate', () => {
  function renderWithDoc(doc: Record<string, unknown>) {
    const client = makeQueryClient({ staleTime: Infinity });
    client.setQueryData(['demi-project', 'proj-1'], doc);
    return renderHook(() => useProjectEaCertificate('proj-1'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
  }

  it('reads the certificate off the project document', async () => {
    await setup(DEMI);

    expect(renderWithDoc({ eaCertificate: ' E23-01 ' }).result.current).toBe('E23-01');
  });

  // The project list is the same DEMI store, so reading it could not find one either.
  it('makes no project list read for a project without a certificate', async () => {
    await setup(DEMI);

    expect(renderWithDoc({ eaCertificate: '' }).result.current).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('when DEMI has no record for the project', () => {
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('Not Found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('settles useDemiProject with null and does not retry, quietly', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    await setup(DEMI);
    const { result } = renderHook(() => useDemiProject('proj-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The route 404s on test until DEMI deploys it; that's an expected answer, not a bug report.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('gives useProjectPhases its empty value', async () => {
    await setup(DEMI);
    const { result } = renderHook(() => useProjectPhases('proj-1'), { wrapper });

    await waitFor(() => expect(result.current).toEqual([]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('phasesOf', () => {
  it('keeps only well-formed rows', () => {
    expect(
      phasesOf({
        phases: [
          { name: 'Early Engagement', startDate: '2020-08-01', endDate: '2021-01-15' },
          { name: '', startDate: '2020-08-01', endDate: null },
          { startDate: '2020-08-01', endDate: null },
          { name: 'Process Planning', startDate: 1234, endDate: {} },
          null,
          'Readiness Decision',
        ],
      }),
    ).toEqual([
      { name: 'Early Engagement', startDate: '2020-08-01', endDate: '2021-01-15' },
      { name: 'Process Planning', startDate: null, endDate: null },
    ]);
  });

  it.each([{}, { phases: null }, { phases: 'Early Engagement' }, null, 'nonsense'])(
    'is empty for %s',
    (payload) => {
      expect(phasesOf(payload)).toEqual([]);
    },
  );
});

describe('phasesOf, Track fields', () => {
  it('keeps isCompleted, eaActName and sortOrder when DEMI sends them typed', () => {
    expect(
      phasesOf({
        phases: [
          ...WORK.phases,
          { name: 'Process Planning', isCompleted: 'yes', eaActName: '', sortOrder: 1.5 },
        ],
      }),
    ).toEqual([WORK.phases[0], { name: 'Process Planning', startDate: null, endDate: null }]);
  });
});

describe('worksOf', () => {
  it.each([{}, { works: null }, { works: {} }, null, 'nonsense'])('is empty for %j', (payload) => {
    expect(worksOf(payload)).toEqual([]);
  });

  it('reads a work exactly as the contract shapes it', () => {
    expect(worksOf({ works: [WORK] })).toEqual([WORK]);
  });

  it('drops keys the contract does not name, at every level', () => {
    const [work] = worksOf({
      works: [
        {
          ...WORK,
          work_notes: 'staff only',
          phases: [{ ...WORK.phases[0], legislated: true }],
          milestones: [{ ...MILESTONE, notes: 'staff only', decision_maker_id: 3 }],
        },
      ],
    });

    expect(Object.keys(work).sort()).toEqual(Object.keys(WORK).sort());
    expect(Object.keys(work.phases[0]).sort()).toEqual(Object.keys(WORK.phases[0]).sort());
    expect(Object.keys(work.milestones[0]).sort()).toEqual(Object.keys(MILESTONE).sort());
  });

  it.each(['2021/03/01', 'March 1, 2021', '2021-13-45', '', 20210301])(
    'reads the non-ISO date %j as null',
    (date) => {
      const [work] = worksOf({
        works: [
          {
            ...WORK,
            startDate: date,
            phases: [{ ...WORK.phases[0], endDate: date }],
            milestones: [{ ...MILESTONE, actualDate: date }],
          },
        ],
      });

      expect(work.startDate).toBeNull();
      expect(work.phases[0].endDate).toBeNull();
      expect(work.milestones[0].actualDate).toBeNull();
    },
  );

  it('drops a work with no id, type id or type name, and a milestone with no name or position', () => {
    const works = worksOf({
      works: [
        { ...WORK, trackWorkId: '12' },
        { ...WORK, workTypeId: undefined },
        { ...WORK, workType: '' },
        {
          ...WORK,
          milestones: [{ ...MILESTONE, name: '' }, { ...MILESTONE, position: 'MIDDLE' }, MILESTONE],
        },
        null,
      ],
    });

    expect(works).toEqual([WORK]);
  });

  it.each(['22', 'Decision', 22.5])('reads the non-integer event type %j as null', (eventType) => {
    const [work] = worksOf({ works: [{ ...WORK, milestones: [{ ...MILESTONE, eventType }] }] });

    expect(work.milestones[0].eventType).toBeNull();
  });

  it('reads an unknown work state as null and a non-boolean isActive as false', () => {
    const [work] = worksOf({ works: [{ ...WORK, workState: 'PAUSED', isActive: 'true' }] });

    expect(work.workState).toBeNull();
    expect(work.isActive).toBe(false);
  });
});
