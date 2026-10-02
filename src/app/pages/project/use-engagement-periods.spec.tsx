import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { notificationToProject } from 'app/api/notification';
import { ProjectNotification } from 'app/models/projectNotification';
import { makeQueryClient } from '../../../test-utils';
import { useEngagementPeriods } from './use-engagement-periods';

const ID = '5c8a3a3ce7f1f1002466c2b1';
const DAY = 24 * 60 * 60 * 1000;

/** A notification holding an open period on its own fields. */
const NOTIFICATION = notificationToProject(
  new ProjectNotification({
    _id: ID,
    name: 'Bear Creek Aggregate',
    pcp: 'open',
    dateStarted: new Date(Date.now() - 3 * DAY).toISOString(),
    dateCompleted: new Date(Date.now() + 4 * DAY).toISOString(),
  }),
).notification;

function renderPeriods(respond: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(respond));
  const client = makeQueryClient();
  return renderHook(() => useEngagementPeriods(ID, NOTIFICATION), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe('useEngagementPeriods', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('holds the notification period back while the period search is in flight', () => {
    const { result } = renderPeriods(() => new Promise<Response>(() => undefined));

    // Showing it now would flash a count the search may then replace.
    expect(result.current).toEqual({ periods: undefined, isPending: true });
  });

  it('falls back to the notification period once the search answers none', async () => {
    const { result } = renderPeriods(async () =>
      Response.json([{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }]),
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.periods).toHaveLength(1);
  });
});
