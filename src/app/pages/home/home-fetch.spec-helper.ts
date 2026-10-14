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

/** A DEMI native read: a plain array of rows, with the total count in the `x-total-count` header. */
export function native(rows: unknown[], total = rows.length): Response {
  const response = json(rows);
  response.headers.set('x-total-count', String(total));
  return response;
}

/** A request that never answers, for the loading state. */
export const PENDING = 'pending' as const;

/**
 * Stubs `fetch` with `answer`, which picks a response by URL; anything it leaves unanswered gets an
 * empty search envelope, or an empty native response under `/demi/api/`. Returns the list the requested URLs are pushed onto.
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
      if (response) return response;
      return url.includes('/demi/api/') ? native([]) : envelope([]);
    }),
  );
  return requests;
}

/** The four Update fields eagle-demi answers as null on a decision row, and an update may leave empty. */
const NO_UPDATE_FIELDS = { shortHeadline: null, summary: null, category: null, publishDate: null };

/** `HomeFeed` rows: the pinned update, then updates and decisions newest first. */
export const HOME_FEED = [
  {
    kind: 'update',
    id: 'u1',
    projectId: 'eagle-1',
    projectName: 'Cedar LNG',
    date: '2026-09-15T12:00:00.000Z',
    headline: 'Application accepted for review',
    ...NO_UPDATE_FIELDS,
    publishDate: '2026-09-15T12:00:00.000Z',
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
    ...NO_UPDATE_FIELDS,
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
    ...NO_UPDATE_FIELDS,
    publishDate: '2026-09-06T12:00:00.000Z',
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
    ...NO_UPDATE_FIELDS,
    content: null,
    documentUrl: null,
  },
  {
    kind: 'update',
    id: 'u5',
    projectId: 'eagle-3',
    projectName: 'Murray River Coal',
    date: '2026-09-01T12:00:00.000Z',
    headline: 'Compliance order issued to Murray River Coal for water discharge',
    shortHeadline: 'Order issued',
    summary: 'The order sets new limits on water discharge.',
    category: 'Compliance',
    publishDate: '2026-09-01T12:00:00.000Z',
    content: null,
    documentUrl: null,
  },
];
