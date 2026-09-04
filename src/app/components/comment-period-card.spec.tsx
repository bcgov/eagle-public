import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { CommentPeriod } from 'app/models/commentperiod';
import { makeQueryClient } from '../../test-utils';
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

function renderCards(periods: CommentPeriod[] | null, onOpen = vi.fn(), loading = false) {
  const result = render(
    <CommentPeriodCards
      periods={periods}
      loading={loading}
      emptyMessage="No comment periods yet."
      onOpen={onOpen}
    />,
  );
  return { ...result, onOpen };
}

function stubFetch(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

function renderPeriodsHook(projectId: string) {
  const queryClient = makeQueryClient();
  return renderHook(() => useCommentPeriods(projectId), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('comment period cards', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('badges an open period with the days remaining', () => {
    renderCards([period()]);

    expect(screen.getByText(/Remaining|Final Day/)).toHaveClass('cp-card__pill--open');
    expect(screen.getByRole('button', { name: 'Share your thoughts' })).toBeInTheDocument();
  });

  it('badges a period that has not started with its start date', () => {
    renderCards([period({ dateStarted: daysFromNow(5), dateCompleted: daysFromNow(20) })]);

    expect(screen.getByText(/^Starts /)).toHaveClass('cp-card__pill--pending');
    expect(screen.getByRole('button', { name: 'View Engagement' })).toBeInTheDocument();
  });

  it('badges a closed period with its end date', () => {
    renderCards([period({ dateStarted: daysFromNow(-20), dateCompleted: daysFromNow(-5) })]);

    expect(screen.getByText(/^Closed /)).toHaveClass('cp-card__pill--closed');
    expect(screen.getByRole('button', { name: 'View Engagement' })).toBeInTheDocument();
  });

  it('hands the clicked period back to the caller', async () => {
    const open = period();
    const { onOpen } = renderCards([open]);

    await userEvent.click(screen.getByRole('button', { name: 'Share your thoughts' }));

    expect(onOpen).toHaveBeenCalledWith(open);
  });

  it('shows placeholder cards while the periods load', () => {
    const { container } = renderCards(null, vi.fn(), true);

    expect(container.getElementsByClassName('cp-card--skeleton')).toHaveLength(2);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
});
