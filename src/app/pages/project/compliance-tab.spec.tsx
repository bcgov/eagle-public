import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { loadConfig } from 'app/config/config';
import { renderAt } from '../../../test-utils';
import { ComplianceTab } from './compliance-tab';

const LISTS = [
  { _id: 'type-inspection-2002', name: 'Inspection Record', legislation: 2002, type: 'doctype' },
  { _id: 'type-inspection-2018', name: 'Inspection Record', legislation: 2018, type: 'doctype' },
  { _id: 'type-order-2002', name: 'Order', legislation: 2002, type: 'doctype' },
  { _id: 'type-order-2018', name: 'Order', legislation: 2018, type: 'doctype' },
  { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
  { _id: 'ms-ce-2018', name: 'Compliance & Enforcement', legislation: 2018, type: 'label' },
];

/** Total per document type id in the request, so each card's own count is checked. */
let totals: Record<string, number> = { 'type-inspection-2002': 11, 'type-order-2002': 0 };
let requests: string[] = [];

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({ project: null, projId: 'proj-1', lists: LISTS }),
  };
});

function renderTab(demiProject?: { eaCertificate?: string }) {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (demiProject && url.includes('/demi-projects/')) {
        return new Response(JSON.stringify(demiProject), { status: 200 });
      }
      const total = Object.entries(totals).find(([id]) => url.includes(id))?.[1] ?? 0;
      return new Response(
        JSON.stringify([{ searchResults: [], meta: [{ searchResultsTotal: total }] }]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }),
  );

  return renderAt('/p/proj-1/compliance', [
    { path: '/p/:projId/compliance', element: <ComplianceTab /> },
  ]);
}

describe('ComplianceTab', () => {
  beforeEach(() => {
    totals = { 'type-inspection-2002': 11, 'type-order-2002': 0 };
  });

  afterEach(() => vi.unstubAllGlobals());

  it('counts inspection records and orders from one-row searches on their document types', async () => {
    renderTab();

    expect(await screen.findByText('11')).toBeInTheDocument();
    expect(screen.getByText('Inspection records published')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Orders issued')).toBeInTheDocument();

    const search = (typeIds: string) =>
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=1&projectLegislation=default' +
      '&sortBy=&sortBy=&populate=false&and[documentSource]=PROJECT' +
      '&and[milestone]=ms-ce-2002&and[milestone]=ms-ce-2018' +
      typeIds +
      '&fuzzy=false';

    expect(requests).toHaveLength(2);
    expect(requests).toContain(
      search('&and[type]=type-inspection-2002&and[type]=type-inspection-2018'),
    );
    expect(requests).toContain(search('&and[type]=type-order-2002&and[type]=type-order-2018'));
  });

  it('links into the compliance and enforcement documents', () => {
    renderTab();

    expect(
      screen.getByRole('link', { name: /View inspection records and orders/ }),
    ).toHaveAttribute('href', '/p/proj-1/documents/compliance');
  });

  it('shows zero counts and keeps the documents link when nothing is published', async () => {
    totals = {};
    renderTab();

    expect(await screen.findAllByText('0')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: /View inspection records and orders/ }),
    ).toBeInTheDocument();
  });

  it('marks the stats busy while the counts are in flight rather than showing a zero', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { container } = renderAt('/p/proj-1/compliance', [
      { path: '/p/:projId/compliance', element: <ComplianceTab /> },
    ]);

    expect(container.querySelector('.compliance-tab__stats[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading compliance record')).toBeInTheDocument();
    expect(container.querySelectorAll('.compliance-tab__stat-value .placeholder')).toHaveLength(2);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  // DEMI_PROJECTS_PATH is unset in every test above, so this is the off-switch case too: no
  // certificate number anywhere means the intro never invents one.
  it('falls back to the certificate placeholder when DEMI is off', async () => {
    renderTab();

    expect(
      await screen.findByText(
        'The certificate carries legally binding conditions. Compliance and enforcement of these' +
          ' conditions is administered separately from the assessment itself.',
      ),
    ).toBeInTheDocument();
  });

  it('names the real certificate number once DEMI has one', async () => {
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '/demi-projects' };
    await loadConfig();
    renderTab({ eaCertificate: 'E23-01' });

    expect(
      await screen.findByText(
        'Certificate E23-01 carries legally binding conditions. Compliance and enforcement of' +
          ' these conditions is administered separately from the assessment itself.',
      ),
    ).toBeInTheDocument();
  });
});
