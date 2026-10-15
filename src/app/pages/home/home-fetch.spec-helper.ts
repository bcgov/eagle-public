import { vi } from 'vitest';

export function json(body: unknown, status = 200): Response {
  return new Response(status === 200 ? JSON.stringify(body) : '', {
    status,
    statusText: status === 200 ? 'OK' : 'Server Error',
    headers: { 'content-type': 'application/json' },
  });
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
 * empty native response. Returns the list the requested URLs are pushed onto.
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
      return native([]);
    }),
  );
  return requests;
}

/**
 * `/updates/feed` rows: the pinned update, then updates, a project decision and a notification
 * decision, newest first.
 */
export const HOME_FEED = [
  {
    kind: 'updates',
    feedDate: '2026-09-15T12:00:00.000Z',
    id: 'u1',
    projectId: 'eagle-1',
    projectName: 'Cedar LNG',
    projectEagleId: 'eagle-1',
    headline: 'Application accepted for review',
    publishDate: '2026-09-15T12:00:00.000Z',
    content: '<p>The application is complete.</p>',
    documentUrl: 'https://example.com/files/acceptance-letter.pdf',
    pinned: true,
  },
  {
    kind: 'projects',
    feedDate: '2026-09-12T12:00:00.000Z',
    id: 'track-2',
    eagleId: 'eagle-2',
    name: 'Kitimat Terminal',
    eacDecision: { _id: 'list-1', name: 'Environmental assessment certificate issued' },
    decisionDate: '2026-09-12T12:00:00.000Z',
  },
  {
    kind: 'updates',
    feedDate: '2026-09-06T12:00:00.000Z',
    id: 'u4',
    projectId: null,
    headline: 'Draft certificate published',
    publishDate: '2026-09-06T12:00:00.000Z',
  },
  {
    kind: 'notifications',
    feedDate: '2026-09-04T12:00:00.000Z',
    id: 'd-orphan',
    name: null,
    associatedProjectId: null,
    associatedProjectName: null,
    decision: 'Exemption order issued',
    decisionDate: '2026-09-04T12:00:00.000Z',
  },
  {
    kind: 'updates',
    feedDate: '2026-09-01T12:00:00.000Z',
    id: 'u5',
    projectId: 'eagle-3',
    projectName: 'Murray River Coal',
    projectEagleId: 'eagle-3',
    headline: 'Compliance order issued to Murray River Coal for water discharge',
    shortHeadline: 'Order issued',
    summary: 'The order sets new limits on water discharge.',
    category: 'Compliance',
    publishDate: '2026-09-01T12:00:00.000Z',
  },
];
