import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, type RenderHookResult } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeQueryClient } from '../../../test-utils';
import type { Project } from 'app/models/project';
import { useProjectTabMeta, type ProjectTab } from './use-project-tab-meta';

const LISTS = [
  { _id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { _id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },
  { _id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { _id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  { _id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { _id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
];

/** Probes are told apart by a list id only that kind's query modifiers carry. */
const CERTIFICATE_PROBE = 'type-cert-2002';
const COMPLIANCE_PROBE = 'ms-ce-2002';
const PROBE_MARKERS = [CERTIFICATE_PROBE, COMPLIANCE_PROBE, 'type-amend-2002', 'type-app-2002'];

/** Four document probes, the updates and documents counts, and the comment periods. */
const EXPECTED_REQUESTS = 7;

let commentPeriods: unknown[];
let updatesTotal: number;
let documentsTotal: number;
let probeHits: string[];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function searchResponse(total: number, results: unknown[] = []) {
  return [{ searchResults: results, meta: [{ searchResultsTotal: total }] }];
}

/** A period whose window brackets today. */
function openPeriod() {
  const started = new Date();
  started.setDate(started.getDate() - 2);
  const completed = new Date();
  completed.setDate(completed.getDate() + 5);
  return {
    _id: 'cp-1',
    dateStarted: started.toISOString(),
    dateCompleted: completed.toISOString(),
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

/** Renders the hook against the stubbed API and waits for every request to answer. */
async function renderTabs(
  project: Partial<Project> | null = null,
): Promise<RenderHookResult<ProjectTab[], unknown>> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/commentperiod?')) return jsonResponse(commentPeriods);
    if (url.includes('dataset=RecentActivity')) return jsonResponse(searchResponse(updatesTotal));
    if (url.includes('dataset=Document')) {
      const probe = PROBE_MARKERS.find((marker) => url.includes(marker));
      if (probe) {
        return jsonResponse(searchResponse(1, probeHits.includes(probe) ? [{ _id: 'doc-1' }] : []));
      }
      return jsonResponse(searchResponse(documentsTotal));
    }
    return jsonResponse(searchResponse(0));
  });
  vi.stubGlobal('fetch', fetchMock);

  const rendered = renderHook(() => useProjectTabMeta('proj-1', LISTS, project as Project | null), {
    wrapper,
  });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_REQUESTS));
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
    updatesTotal = 0;
    documentsTotal = 0;
    probeHits = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('always offers Overview, Updates, Engagement and Documents', async () => {
    updatesTotal = 3;

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
    updatesTotal = 24;
    documentsTotal = 1284;

    const { result } = await renderTabs();

    await waitFor(() => expect(countOf(result.current, 'documents')).toBe('1,284'));
    expect(countOf(result.current, 'updates')).toBe('24');
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
