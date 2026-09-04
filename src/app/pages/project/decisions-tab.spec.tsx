import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAt } from '../../../test-utils';
import { DecisionsTab } from './decisions-tab';

const LISTS = [
  { _id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { _id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
  { _id: 'type-order-2002', name: 'Order', legislation: 2002, type: 'doctype' },
  { _id: 'type-order-2018', name: 'Order', legislation: 2018, type: 'doctype' },
  { _id: 'type-dm-2002', name: 'Decision Materials', legislation: 2002, type: 'doctype' },
  { _id: 'type-dm-2018', name: 'Decision Materials', legislation: 2018, type: 'doctype' },
  { _id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },
  { _id: 'ms-certdec-2018', name: 'Certificate Decision', legislation: 2018, type: 'label' },
  { _id: 'ms-decision-2002', name: 'Decision', legislation: 2002, type: 'label' },
  { _id: 'ms-certext-2002', name: 'Certificate Extension', legislation: 2002, type: 'label' },
  { _id: 'ms-certext-2018', name: 'Certificate Extension', legislation: 2018, type: 'label' },
  {
    _id: 'ms-transfer-2018',
    name: 'Transfer of Certificate/Order',
    legislation: 2018,
    type: 'label',
  },
];

const DOCUMENTS = [
  {
    _id: 'doc-1',
    displayName: 'Environmental Assessment Certificate E23-01',
    documentFileName: 'certificate-e23-01.pdf',
    datePosted: '2023-03-14T12:00:00.000Z',
    type: 'type-cert-2018',
    milestone: 'ms-certdec-2018',
    project: 'proj-1',
  },
  {
    _id: 'doc-2',
    displayName: 'Schedule B',
    documentFileName: 'schedule-b.pdf',
    datePosted: '2023-03-01T12:00:00.000Z',
    type: 'type-cert-2018',
    milestone: 'ms-unknown',
    project: 'proj-1',
  },
];

const DECIDED = {
  eacDecision: { name: 'Certificate Issued' },
  decisionDate: '2023-03-14T12:00:00.000Z',
};

const TRANSFERRED = {
  eacDecision: { name: 'Regulatory Transfer' },
  applicableRegulation: { name: 'BC Energy Regulator', item: 'https://www.bc-er.ca/projects/' },
};

let project: any = DECIDED;
let documents = DOCUMENTS;
let requests: string[] = [];

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({ project, projId: 'proj-1', lists: LISTS }),
  };
});

function renderTab() {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(
        JSON.stringify([
          { searchResults: documents, meta: [{ searchResultsTotal: documents.length }] },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );

  return renderAt('/p/proj-1/decisions', [
    { path: '/p/:projId/decisions', element: <DecisionsTab /> },
  ]);
}

describe('DecisionsTab', () => {
  beforeEach(() => {
    project = DECIDED;
    documents = DOCUMENTS;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('names the EA decision and its date', async () => {
    renderTab();

    expect(screen.getByRole('heading', { level: 2, name: 'Decisions' })).toBeInTheDocument();
    expect(screen.getByText('Certificate Issued')).toBeInTheDocument();
    expect(screen.getByText('March 14, 2023')).toBeInTheDocument();
    await screen.findByText('Environmental Assessment Certificate E23-01');
  });

  it('links a transferred project to its regulator instead of naming a decision date', async () => {
    project = TRANSFERRED;
    renderTab();

    expect(screen.getByRole('link', { name: 'BC Energy Regulator' })).toHaveAttribute(
      'href',
      'https://www.bc-er.ca/projects/',
    );
    expect(screen.queryByText('Regulatory Transfer')).not.toBeInTheDocument();
    await screen.findByText('Environmental Assessment Certificate E23-01');
  });

  it('lists the certificate-set documents, newest first, with a download link', async () => {
    renderTab();

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Environmental Assessment Certificate E23-01',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mar 14, 2023')).toBeInTheDocument();
    expect(screen.getByText('Certificate Package · Certificate Decision')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Schedule B' })).toBeInTheDocument();
    expect(screen.getByText('Certificate Package')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'certificate-e23-01.pdf' })).toHaveAttribute(
      'href',
      '/api/public/document/doc-1/download/certificate-e23-01.pdf',
    );

    expect(requests.at(-1)).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=10&projectLegislation=default' +
        '&sortBy=-datePosted&sortBy=+displayName&populate=false' +
        '&and[documentSource]=PROJECT' +
        '&and[type]=type-cert-2002&and[type]=type-cert-2018&and[type]=type-order-2002&and[type]=type-order-2018' +
        '&and[type]=type-dm-2002&and[type]=type-dm-2018' +
        '&and[milestone]=ms-cert-2002&and[milestone]=ms-certdec-2018&and[milestone]=ms-decision-2002' +
        '&and[milestone]=ms-certext-2002&and[milestone]=ms-certext-2018&and[milestone]=ms-transfer-2018' +
        '&fuzzy=false',
    );
  });

  it('says so when the project has no decision documents', async () => {
    documents = [];
    renderTab();

    expect(
      await screen.findByText('No decision documents have been posted for this project.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
