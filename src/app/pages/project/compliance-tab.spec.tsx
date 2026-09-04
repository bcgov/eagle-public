import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
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

function renderTab() {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
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
      screen.getByRole('link', { name: /View compliance and enforcement documents/ }),
    ).toHaveAttribute('href', '/p/proj-1/documents/compliance');
  });

  it('shows zero counts and keeps the documents link when nothing is published', async () => {
    totals = {};
    renderTab();

    expect(await screen.findAllByText('0')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: /View compliance and enforcement documents/ }),
    ).toBeInTheDocument();
  });
});
