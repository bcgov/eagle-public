import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, type RenderHookResult } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient as appQueryClient } from 'app/api/query-client';
import { nativeDocument } from 'app/models/demi/document.fixture';
import { json, native, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { makeQueryClient } from '../../../test-utils';
import type { Project } from 'app/models/project';
import { useProjectTabMeta, type ProjectTab } from './use-project-tab-meta';

const LISTS = [
  { id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },
  { id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  { id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
  { id: 'type-mp-2018', name: 'Management Plan', legislation: 2018, type: 'doctype' },
];

/** Probes are told apart by a list id only that kind's filters carry. */
const CERTIFICATE_PROBE = 'type-cert-2002';
const COMPLIANCE_PROBE = 'ms-ce-2002';
const PROBE_MARKERS = [
  CERTIFICATE_PROBE,
  COMPLIANCE_PROBE,
  'type-amend-2002',
  'type-app-2002',
  'type-mp-2018',
];

/** Five document probes, the updates and documents counts, the DEMI project and its comment periods. */
const EXPECTED_REQUESTS = 9;

let commentPeriods: unknown[];
let updateRows: Record<string, unknown>[];

function visibleUpdates(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `u${index}`, headline: 'Update' }));
}
let documentsTotal: number;
let probeHits: string[];
/** Every URL the hook asked for, decoded. */
let requests: string[];

/** A period whose window brackets today. */
function openPeriod() {
  const started = new Date();
  started.setDate(started.getDate() - 2);
  const completed = new Date();
  completed.setDate(completed.getDate() + 5);
  return {
    id: 'cp-1',
    dateStarted: started.toISOString(),
    dateCompleted: completed.toISOString(),
  };
}

let client = makeQueryClient();

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Renders the hook against the stubbed API and waits for every request to answer. */
async function renderTabs(
  project: Partial<Project> | null = null,
): Promise<RenderHookResult<ProjectTab[], unknown>> {
  requests = stubFetch((url) => {
    if (url.startsWith('/demi-projects/')) return json({ id: '26', eagleId: 'proj-1' });
    if (url.includes('/demi/api/comment-periods')) return native(commentPeriods);
    if (url.startsWith('/demi/api/updates?')) return native(updateRows);
    if (url.startsWith('/demi/api/documents?')) {
      const probe = PROBE_MARKERS.find((marker) => url.includes(marker));
      if (probe) {
        return probeHits.includes(probe) ? native([nativeDocument({ _id: 'doc-1' })]) : native([]);
      }
      return native([], documentsTotal);
    }
    return undefined;
  });
  client = makeQueryClient();

  const rendered = renderHook(() => useProjectTabMeta('proj-1', LISTS, project as Project | null), {
    wrapper,
  });

  await waitFor(() => expect(requests).toHaveLength(EXPECTED_REQUESTS));
  return rendered;
}

function countOf(tabs: ProjectTab[], key: string): string | undefined {
  return tabs.find((tab) => tab.key === key)?.count;
}

function shown(tabs: ProjectTab[]): string[] {
  return tabs.filter((tab) => tab.show).map((tab) => tab.key);
}

describe('useProjectTabMeta', () => {
  beforeEach(() => {
    commentPeriods = [];
    updateRows = [];
    documentsTotal = 0;
    probeHits = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    appQueryClient.clear();
  });

  it('offers Overview, Engagement and Documents always, and Updates once one is visible', async () => {
    updateRows = visibleUpdates(3);

    const { result } = await renderTabs({ eacDecision: { name: 'In Progress' } });

    await waitFor(() => expect(countOf(result.current, 'updates')).toBe('3'));
    expect(shown(result.current)).toEqual(['overview', 'updates', 'engagement', 'documents']);
    expect(result.current.map((tab) => tab.label)).toEqual([
      'Overview',
      'Updates',
      'Engagement',
      'Documents',
      'Decisions',
      'Compliance',
    ]);
  });

  it('counts updates and documents, formatting the document total', async () => {
    updateRows = visibleUpdates(24);
    documentsTotal = 1284;

    const { result } = await renderTabs();

    await waitFor(() => expect(countOf(result.current, 'documents')).toBe('1,284'));
    expect(countOf(result.current, 'updates')).toBe('24');
  });

  it('hides Updates once the list lands with only drafts and archived rows', async () => {
    updateRows = [
      { id: 'd', headline: 'Draft', status: 'draft' },
      { id: 'a', headline: 'Gone', status: 'archived' },
    ];

    const { result } = await renderTabs();

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(shown(result.current)).toEqual(['overview', 'engagement', 'documents']);
  });

  it('holds Updates in the strip while its list is loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    client = makeQueryClient();

    const { result } = renderHook(() => useProjectTabMeta('proj-1', LISTS, null), { wrapper });

    const updates = result.current.find((tab) => tab.key === 'updates');
    expect(updates?.show).toBe(true);
    expect(updates?.countPending).toBe(true);
  });

  it('holds the Documents count while its first total is loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    client = makeQueryClient();

    const { result } = renderHook(() => useProjectTabMeta('proj-1', LISTS, null), { wrapper });

    expect(result.current.find((tab) => tab.key === 'documents')?.countPending).toBe(true);
  });

  it('does not hold the Documents count while a cached zero total refetches', async () => {
    const { result } = await renderTabs();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    void client.invalidateQueries({ queryKey: ['table', 'projectTabDocuments'] });

    await waitFor(() => expect(client.isFetching()).toBeGreaterThan(0));
    expect(result.current.find((tab) => tab.key === 'documents')?.countPending).toBe(false);
  });

  it('asks for the documents count and each document kind one row at a time, by DEMI project id', async () => {
    await renderTabs();

    const one = '/demi/api/documents?page=1&pageSize=1&count=true';
    expect(requests.filter((url) => url.startsWith('/demi/api/documents?')).sort()).toEqual([
      `${one}&documentSource=PROJECT&milestoneId=ms-ce-2002&project=26`,
      `${one}&documentSource=PROJECT&typeId=type-amend-2002&milestoneId=ms-amend-2002&project=26`,
      `${one}&documentSource=PROJECT&typeId=type-app-2002&milestoneId=ms-appreview&project=26`,
      `${one}&documentSource=PROJECT&typeId=type-cert-2002&milestoneId=ms-cert-2002&project=26`,
      `${one}&documentSource=PROJECT&typeId=type-mp-2018&project=26`,
      `${one}&project=26`,
    ]);
  });

  it('leaves a zero total uncounted', async () => {
    const { result } = await renderTabs();

    await waitFor(() => expect(countOf(result.current, 'engagement')).toBeUndefined());
    expect(countOf(result.current, 'updates')).toBeUndefined();
    expect(countOf(result.current, 'documents')).toBeUndefined();
  });

  it('counts open comment periods and ignores closed ones', async () => {
    commentPeriods = [
      openPeriod(),
      { _id: 'cp-0', dateStarted: '2020-01-01', dateCompleted: '2020-02-01' },
    ];

    const { result } = await renderTabs();

    await waitFor(() => expect(countOf(result.current, 'engagement')).toBe('1 open'));
  });

  it('hides Decisions while the project is in progress with no certificate documents', async () => {
    probeHits = [COMPLIANCE_PROBE];

    const { result } = await renderTabs({ eacDecision: { name: 'In Progress' } });

    // Compliance proves the probes have answered, so the missing Decisions tab is a decision, not
    // a request still in flight.
    await waitFor(() => expect(shown(result.current)).toContain('compliance'));
    expect(shown(result.current)).not.toContain('decisions');
  });

  it('shows Decisions once a decision is recorded', async () => {
    const { result } = await renderTabs({ eacDecision: { name: 'Certificate Issued' } });

    expect(shown(result.current)).toContain('decisions');
  });

  it('shows Decisions for an undecided project that has certificate documents', async () => {
    probeHits = [CERTIFICATE_PROBE];

    const { result } = await renderTabs({ eacDecision: { name: 'In Progress' } });

    await waitFor(() => expect(shown(result.current)).toContain('decisions'));
    expect(shown(result.current)).not.toContain('compliance');
  });

  it('shows Compliance only when the project has compliance documents', async () => {
    probeHits = [COMPLIANCE_PROBE];

    const { result } = await renderTabs();

    await waitFor(() => expect(shown(result.current)).toContain('compliance'));
    expect(shown(result.current)).not.toContain('decisions');
  });
});
