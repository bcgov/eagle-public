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

/** A `RecentActivity` row, as the reader's by-id read answers. Noon UTC keeps the day the same everywhere. */
export const ACTIVITY_ROW = {
  _id: 'u1',
  headline: 'Application accepted for review',
  content: '<p>The application is complete.</p>',
  type: 'News',
  active: true,
  dateAdded: '2026-09-15T12:00:00.000Z',
  documentUrl: 'https://example.com/files/acceptance-letter.pdf',
  project: { _id: 'eagle-1', name: 'Cedar LNG' },
};

/** `HomeFeed` rows: the pinned update, then updates and decisions newest first. */
export const HOME_FEED = [
  {
    kind: 'update',
    id: 'u1',
    projectId: 'eagle-1',
    projectName: 'Cedar LNG',
    date: '2026-09-15T12:00:00.000Z',
    headline: 'Application accepted for review',
    content: '<p>The application is complete.</p>',
    documentUrl: 'https://example.com/files/acceptance-letter.pdf',
  },
  {
    kind: 'decision',
    id: 'eagle-2',
    projectId: 'eagle-2',
    projectName: 'Kitimat Terminal',
    date: '2026-09-12T12:00:00.000Z',
    headline: 'Environmental assessment certificate issued',
    content: null,
    documentUrl: null,
  },
  {
    kind: 'update',
    id: 'u4',
    projectId: null,
    projectName: null,
    date: '2026-09-06T12:00:00.000Z',
    headline: 'Draft certificate published',
    content: null,
    documentUrl: null,
  },
  {
    kind: 'decision',
    id: 'd-orphan',
    projectId: null,
    projectName: null,
    date: '2026-09-04T12:00:00.000Z',
    headline: 'Exemption order issued',
    content: null,
    documentUrl: null,
  },
  {
    kind: 'update',
    id: 'u5',
    projectId: 'eagle-3',
    projectName: 'Murray River Coal',
    date: '2026-09-01T12:00:00.000Z',
    headline: 'Order issued',
    content: null,
    documentUrl: null,
  },
];
