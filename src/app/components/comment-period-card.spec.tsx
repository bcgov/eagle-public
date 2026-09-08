import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { CommentPeriod } from 'app/models/commentperiod';
import { makeQueryClient, renderAt } from '../../test-utils';
import { CommentPeriodCards } from './comment-period-card';
import { useCommentPeriods } from './use-comment-periods';

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function period(overrides: Record<string, unknown> = {}): CommentPeriod {
  return new CommentPeriod({
    _id: 'cp-1',
    dateStarted: daysFromNow(-3),
    dateCompleted: daysFromNow(4),
    informationLabel: 'Cedar Quarry Application',
    ...overrides,
  });
}

function renderCards(
  periods: CommentPeriod[] | null,
  { basePath = '/p/proj-1', loading = false }: { basePath?: string | null; loading?: boolean } = {},
) {
  return renderAt('/start', [
    {
      path: '/start',
      element: (
        <CommentPeriodCards
          periods={periods}
          loading={loading}
          emptyMessage="No comment periods yet."
          basePath={basePath}
        />
      ),
    },
  ]);
}

/** Comment periods arrive in the `/search` envelope both backends answer with. */
function stubFetch(periods: unknown[]) {
  const body = [{ searchResults: periods, meta: [{ searchResultsTotal: periods.length }] }];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

function renderPeriodsHook(projectId: string) {
  const queryClient = makeQueryClient();
  return {
    ...renderHook(() => useCommentPeriods(projectId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    }),
    queryClient,
  };
}

describe('comment period cards', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('badges an open period with the days remaining', () => {
    renderCards([period()]);

    expect(screen.getByText(/Remaining|Final Day/)).toHaveClass('cp-card__pill--open');
    expect(screen.getByRole('link', { name: 'Share your thoughts' })).toBeInTheDocument();
  });

  it('badges a period that has not started with its start date', () => {
    renderCards([period({ dateStarted: daysFromNow(5), dateCompleted: daysFromNow(20) })]);

    expect(screen.getByText(/^Starts /)).toHaveClass('cp-card__pill--pending');
    expect(screen.getByRole('link', { name: 'View Engagement' })).toBeInTheDocument();
  });

  it('badges a closed period with its end date', () => {
    renderCards([period({ dateStarted: daysFromNow(-20), dateCompleted: daysFromNow(-5) })]);

    expect(screen.getByText(/^Closed /)).toHaveClass('cp-card__pill--closed');
    expect(screen.getByRole('link', { name: 'View Engagement' })).toBeInTheDocument();
  });

  it('points an EPIC-hosted period at the route the caller owns', () => {
    renderCards([period()], { basePath: '/pn/notification-1' });

    expect(screen.getByRole('link', { name: 'Share your thoughts' })).toHaveAttribute(
      'href',
      '/pn/notification-1/cp/cp-1',
    );
  });

  it('sends an ENGAGE-hosted period out to its own site, whatever the caller routes', () => {
    renderCards([period({ isMet: true, metURL: 'https://engage.example/cedar' })]);

    const link = screen.getByRole('link', { name: 'Share your thoughts (opens in new tab)' });
    expect(link).toHaveAttribute('href', 'https://engage.example/cedar');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('drops the call to action when the caller has no route for the period', () => {
    renderCards([period()], { basePath: null });

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows placeholder cards while the periods load', () => {
    const { container } = renderCards(null, { loading: true });

    expect(container.getElementsByClassName('cp-card--skeleton')).toHaveLength(2);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('No comment periods yet.')).not.toBeInTheDocument();
  });

  it('shows the empty message when there are no periods', () => {
    renderCards([]);

    expect(screen.getByText('No comment periods yet.')).toBeInTheDocument();
  });
});

describe('useCommentPeriods', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drops periods repeating an id', async () => {
    stubFetch([
      { _id: 'cp-1', informationLabel: 'First' },
      { _id: 'cp-1', informationLabel: 'Same id, later copy' },
      { _id: 'cp-2', informationLabel: 'Second' },
    ]);

    const { result } = renderPeriodsHook('proj-1');

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((cp) => cp._id)).toEqual(['cp-1', 'cp-2']);
  });

  it('drops ENGAGE periods pointing at the same engagement', async () => {
    stubFetch([
      { _id: 'cp-1', isMet: true, metURL: 'https://engage.example/cedar' },
      { _id: 'cp-2', isMet: true, metURL: 'https://engage.example/cedar' },
      { _id: 'cp-3', isMet: true, metURL: 'https://engage.example/spruce' },
    ]);

    const { result } = renderPeriodsHook('proj-1');

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((cp) => cp._id)).toEqual(['cp-1', 'cp-3']);
  });

  it('titles a period from the subject inside its instructions', async () => {
    stubFetch([
      {
        _id: 'cp-1',
        instructions: '<p>Public   Comment Period on the <b>Draft Application</b> for Cedar.</p>',
      },
    ]);

    const { result } = renderPeriodsHook('proj-1');

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.[0].instructions).toBe('Draft Application');
    expect(result.current.data?.[0].additionalText).toBe(
      'Public Comment Period on the Draft Application for Cedar.',
    );
  });

  it('leaves the cached rows other readers share unedited', async () => {
    const instructions = '<p>Comment Period on the <b>Draft Application</b> for Cedar.</p>';
    stubFetch([{ _id: 'cp-1', instructions, informationLabel: 'Cedar Quarry' }]);

    const { result, queryClient } = renderPeriodsHook('proj-1');

    await waitFor(() => expect(result.current.data).toBeDefined());
    const cached = queryClient.getQueryData<CommentPeriod[]>(['commentPeriods', 'proj-1']);
    expect(cached?.[0].instructions).toBe(instructions);
    expect(cached?.[0].additionalText).toBeUndefined();
  });

  it('keeps the model getters on the normalized rows', async () => {
    stubFetch([
      {
        _id: 'cp-1',
        dateStarted: daysFromNow(-3),
        dateCompleted: daysFromNow(4),
        instructions: '<p>Comment Period on the <b>Draft Application</b> for Cedar.</p>',
      },
    ]);

    const { result } = renderPeriodsHook('proj-1');

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.[0].bannerState).toBe('Open');
    expect(result.current.data?.[0].bannerCTA).toBe('Share your thoughts');
  });
});
