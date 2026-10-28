import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet } from 'react-router';
import type { DemiProject } from 'app/api/api';
import { renderAt } from '../../../test-utils';
import type { ProjectContext } from './project-context';
import {
  ACT_1996_PROJECT,
  AMENDMENT_DOCUMENTS,
  CEDAR,
  CERTIFIED_2002,
  CROWN_MOUNTAIN,
  TODAY,
  TRANSITIONED,
  narrowViewport,
  work,
} from './timeline.fixture';
import { TimelineTab } from './timeline-tab';
import { buildTimelineModel, useTimelineModel, type TimelineModel } from './use-timeline-model';

// The model's reads are its own slice's concern; here it is built straight from a fixture.
vi.mock('./use-timeline-model', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./use-timeline-model')>()),
  useTimelineModel: vi.fn(),
}));

const LISTS = [
  { id: 'list-early', type: 'projectPhase', name: 'Early Engagement', legislation: 2018 },
];

function modelOf(project: DemiProject): TimelineModel {
  return buildTimelineModel({ project, documents: [], lists: [], today: TODAY });
}

function renderTab(model: TimelineModel | null, at = '/p/proj-1/timeline') {
  vi.mocked(useTimelineModel).mockReturnValue(model);
  const context: ProjectContext = {
    project: null,
    projId: 'proj-1',
    basePath: '/p/proj-1',
    isNotification: false,
    lists: LISTS,
    projectLoading: false,
  };
  return renderAt(at, [
    {
      path: '/p/:projId',
      element: <Outlet context={context} />,
      children: [{ path: 'timeline', Component: TimelineTab }],
    },
  ]).router;
}

const list = () => screen.getByRole('list', { name: 'Timeline, oldest first' });
const details = () => screen.getByRole('complementary', { name: 'Selected item' });
const idOf = (model: TimelineModel, title: string) =>
  model.items.find((item) => item.title === title)?.id ?? '';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TimelineTab', () => {
  it('says the timeline is loading until the model lands', () => {
    renderTab(null);

    expect(screen.getByRole('heading', { level: 2, name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByText('Loading the timeline')).toBeInTheDocument();
  });

  it('shows the summary line and the default selection', () => {
    const model = modelOf(CEDAR);
    renderTab(model);

    expect(screen.getByText(model.summary)).toBeInTheDocument();
    const selected = model.items.find((item) => item.id === model.defaultSelectedId);
    expect(
      within(details()).getByRole('heading', { level: 3, name: selected?.title }),
    ).toBeInTheDocument();
  });

  it('preselects ?item= and opens the history row it folds under', () => {
    const model = modelOf(TRANSITIONED);
    const child = model.items.find((item) => item.kind === 'phase' && item.parentId);
    if (!child?.parentId) throw new Error('TRANSITIONED has no folded phase');
    const parent = model.items.find((item) => item.id === child.parentId);

    renderTab(model, `/p/proj-1/timeline?item=${child.id}`);

    expect(within(details()).getByRole('heading', { level: 3 })).toHaveTextContent(child.title);
    expect(
      within(list()).getByRole('button', { name: new RegExp(`^${parent?.title}`) }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the history row of a folded phase the search lands on', async () => {
    const user = userEvent.setup();
    const model = modelOf(TRANSITIONED);
    const child = model.items.find((item) => item.kind === 'phase' && item.parentId);
    const parent = model.items.find((item) => item.id === child?.parentId);
    renderTab(model);
    const history = within(list()).getByRole('button', { name: new RegExp(`^${parent?.title}`) });
    expect(history).toHaveAttribute('aria-expanded', 'false');

    await user.type(screen.getByRole('searchbox'), child?.title ?? '');

    expect(history).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(list()).getAllByRole('button', { name: new RegExp(`^${child?.title}`) }).length,
    ).toBeGreaterThan(0);
  });

  it('writes the selected row to ?item=', async () => {
    const user = userEvent.setup();
    const model = modelOf(CEDAR);
    const router = renderTab(model);

    await user.click(within(list()).getByRole('button', { name: /^Amendment #2/ }));

    expect(new URLSearchParams(router.state.location.search).get('item')).toBe(
      idOf(model, 'Amendment #2'),
    );
  });

  it('keeps the typed query in ?q= while the search selects its first hit', async () => {
    const user = userEvent.setup();
    const model = modelOf(CEDAR);
    const router = renderTab(model);

    await user.type(screen.getByRole('searchbox'), 'Amendment #3');

    const params = new URLSearchParams(router.state.location.search);
    expect(params.get('q')).toBe('Amendment #3');
    expect(params.get('item')).toBe(idOf(model, 'Amendment #3'));
    expect(screen.getByRole('searchbox')).toHaveValue('Amendment #3');
  });

  it('hides other work types from the list under a filter, keeping Today', async () => {
    const user = userEvent.setup();
    renderTab(modelOf(CEDAR));

    await user.click(screen.getByRole('button', { name: 'Amendments' }));

    expect(screen.getByRole('button', { name: 'Amendments' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(list()).queryByRole('button', { name: /^Early Engagement/ })).toBeNull();
    expect(within(list()).getByRole('button', { name: /^Amendment #1/ })).toBeInTheDocument();
    expect(within(list()).getByRole('button', { name: /^Today/ })).toBeInTheDocument();
  });

  it('keeps a same-day group under a filter that matches only one of its works', async () => {
    const user = userEvent.setup();
    renderTab(
      modelOf({
        ...CEDAR,
        works: [
          work({ title: 'Amendment 3', startDate: '2025-04-07' }),
          work({ workTypeId: 9, workType: 'EAC Extension', startDate: '2025-04-07' }),
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Other work' }));

    expect(
      within(list()).getByRole('button', { name: /^2 works received the same day/ }),
    ).toBeInTheDocument();
    expect(within(list()).getByRole('button', { name: /^EAC Extension/ })).toBeInTheDocument();
    expect(within(list()).queryByRole('button', { name: /^Amendment 3/ })).toBeNull();
  });

  it('goes back to All when the search lands on a row the filter hides', async () => {
    const user = userEvent.setup();
    renderTab(modelOf(CEDAR));
    await user.click(screen.getByRole('button', { name: 'Amendments' }));

    await user.type(screen.getByRole('searchbox'), 'Early Engagement');

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(list()).getByRole('button', { name: /^Early Engagement/ })).toBeInTheDocument();
  });

  it('keeps the filter when the search lands on a row it shows', async () => {
    const user = userEvent.setup();
    renderTab(modelOf(CEDAR));
    await user.click(screen.getByRole('button', { name: 'Amendments' }));

    await user.type(screen.getByRole('searchbox'), 'Amendment #2');

    expect(screen.getByRole('button', { name: 'Amendments' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  const certificate = (model: TimelineModel) =>
    model.items.find((item) => item.kind === 'certificate')?.id ?? '';
  const titled = (title: string) => (model: TimelineModel) => idOf(model, title);

  it.each([
    ['the certificate', certificate, /^Read the certificate/, '/p/proj-1/decisions'],
    ['a work', titled('Amendment #1'), /^Amendment documents/, '/p/proj-1/documents/amendments'],
    [
      'a phase',
      titled('Early Engagement'),
      /^Documents for this phase/,
      '/p/proj-1/documents?projectPhase=list-early',
    ],
  ])('links %s to its documents', (_what, pick, name, href) => {
    const model = modelOf(CEDAR);

    renderTab(model, `/p/proj-1/timeline?item=${pick(model)}`);

    expect(within(details()).getByRole('link', { name })).toHaveAttribute('href', href);
  });

  it('draws no phase link when no list row names the phase', () => {
    const model = modelOf(CEDAR);

    renderTab(model, `/p/proj-1/timeline?item=${idOf(model, 'Readiness Decision')}`);

    expect(within(details()).queryByRole('link')).toBeNull();
  });

  it('draws the lanes beside the list on a wide screen', () => {
    renderTab(modelOf(CEDAR));

    expect(screen.getByRole('region', { name: 'Lanes overview' })).toBeInTheDocument();
    expect(within(list()).queryByRole('complementary')).toBeNull();
  });

  it('draws the details inside the list, and no lanes, on a narrow screen', () => {
    narrowViewport();
    renderTab(modelOf(CEDAR));

    expect(within(list()).getByRole('complementary', { name: 'Selected item' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Lanes overview' })).toBeNull();
  });

  it('opens a pre-Track document as a file, outside the router', async () => {
    const model = buildTimelineModel({
      project: CERTIFIED_2002,
      documents: AMENDMENT_DOCUMENTS,
      lists: [],
      today: TODAY,
    });
    const router = renderTab(model, '/p/proj-1/timeline?item=document-doc-0');
    const link = within(details()).getByRole('link', { name: /^Open document/ });
    // Runs after the router's own handler, and stops jsdom from trying to navigate.
    let routed = true;
    const after = (event: Event) => {
      routed = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', after);

    await userEvent.setup().click(link);
    window.removeEventListener('click', after);

    expect(link).toHaveAttribute('href', '/demi-search/documents/doc-0/download?redirect=1');
    expect(routed).toBe(false);
    expect(router.state.location.pathname).toBe('/p/proj-1/timeline');
  });

  it('marks the current stage after the certificate', () => {
    renderTab(modelOf(CEDAR));

    const stages = screen.getByRole('region', { name: 'Stage after the certificate' });
    const current = within(stages)
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current.map((li) => li.textContent)).toEqual(['ConstructionCurrent stage']);
  });

  it('says the stage is not recorded when it holds no known stage', () => {
    renderTab(modelOf(ACT_1996_PROJECT));

    const stages = screen.getByRole('region', { name: 'Stage after the certificate' });
    expect(within(stages).getByText('Current stage: Not recorded')).toBeInTheDocument();
    expect(stages.querySelector('[aria-current]')).toBeNull();
  });

  it('has no stage after the certificate before a certificate is issued', () => {
    renderTab(modelOf(CROWN_MOUNTAIN));

    expect(screen.queryByRole('region', { name: 'Stage after the certificate' })).toBeNull();
  });

  it('boxes on the lanes the dates of the list rows in view', () => {
    let report: IntersectionObserverCallback = () => undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          report = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    const model = modelOf(CEDAR);
    renderTab(model);
    const rowOf = (title: string) =>
      list().querySelector(`li[data-id="${idOf(model, title)}"]`) as Element;

    act(() =>
      report(
        [rowOf('Early Engagement'), rowOf('Process Planning')].map(
          (target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
        ),
        {} as IntersectionObserver,
      ),
    );

    const lanes = screen.getByRole('region', { name: 'Lanes overview' });
    expect(lanes).toHaveTextContent(/list showing 2020 – 2021/i);
  });
});
