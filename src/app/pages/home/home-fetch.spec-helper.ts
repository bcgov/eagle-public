import { vi } from 'vitest';

export function json(body: unknown, status = 200): Response {
  return new Response(status === 200 ? JSON.stringify(body) : '', {
    status,
    statusText: status === 200 ? 'OK' : 'Server Error',
    headers: { 'content-type': 'application/json' },
  });
}

/** The `[{ searchResults, meta }]` envelope `/search` answers with, plus any extra top-level keys. */
export function envelope(rows: unknown[], extra: Record<string, unknown> = {}): Response {
  return json([{ searchResults: rows, meta: [{ searchResultsTotal: rows.length }], ...extra }]);
}

/** A request that never answers, for the loading state. */
export const PENDING = 'pending' as const;

/**
 * Stubs `fetch` with `answer`, which picks a response by URL; anything it leaves unanswered gets an
 * empty search envelope. Returns the list the requested URLs are pushed onto.
 */
export function stubFetch(
  answer: (url: string) => Response | typeof PENDING | undefined,
): string[] {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      requests.push(url);
      const response = answer(url);
      if (response === PENDING) return new Promise<Response>(() => undefined);
      return response ?? envelope([]);
    }),
  );
  return requests;
}

/** `RecentActivity` rows. Noon UTC keeps the formatted day the same either side of the date line. */
export const ACTIVITY = [
  {
    _id: 'u1',
    headline: 'Application accepted for review',
    content: '<p>The application is complete.</p>',
    type: 'News',
    active: true,
    dateAdded: '2026-09-15T12:00:00.000Z',
    documentUrl: 'https://example.com/files/acceptance-letter.pdf',
    project: { _id: 'eagle-1', name: 'Cedar LNG' },
  },
  {
    _id: 'u2',
    headline: 'Comment period opens',
    type: 'Public Comment Period',
    active: true,
    dateAdded: '2026-09-10T12:00:00.000Z',
    project: { _id: 'eagle-2', name: 'Kitimat Terminal' },
  },
  {
    _id: 'u3',
    headline: 'Withdrawn notice',
    type: 'News',
    active: false,
    dateAdded: '2026-09-08T12:00:00.000Z',
    project: { _id: 'eagle-3', name: 'Murray River Coal' },
  },
  {
    _id: 'u4',
    headline: 'Draft certificate published',
    type: 'Project Notification News',
    active: true,
    dateAdded: '2026-09-06T12:00:00.000Z',
    project: null,
  },
];
