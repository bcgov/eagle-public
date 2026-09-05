import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { loadConfig } from 'app/config/config';
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
/** The EA-decision certificate document, or null for the "nothing found" default. */
let certDocument: any = null;
let requests: string[] = [];

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({ project, projId: 'proj-1', lists: LISTS }),
  };
});

function renderTab(demiProject?: { eaCertificate?: string }) {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('/demi-projects/')) {
        return new Response(JSON.stringify(demiProject ?? {}), { status: 200 });
      }
      // Only the EA-decision certificate query asks for a single row.
      if (url.includes('pageSize=1&')) {
        return new Response(
          JSON.stringify([
            {
              searchResults: certDocument ? [certDocument] : [],
              meta: [{ searchResultsTotal: certDocument ? 1 : 0 }],
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
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
    certDocument = null;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('names the EA decision and its date', async () => {
    renderTab();

    expect(screen.getByRole('heading', { level: 2, name: 'Decisions' })).toBeInTheDocument();
    expect(screen.getByText('Certificate Issued')).toBeInTheDocument();
    expect(screen.getByText('March 14, 2023')).toBeInTheDocument();
    await screen.findByText('Environmental Assessment Certificate E23-01');
  });

  it('shows the certificate number beside the decision date once DEMI has one', async () => {
    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '/demi-projects' };
    await loadConfig();
    renderTab({ eaCertificate: 'E23-01' });

    expect(await screen.findByText('March 14, 2023 · E23-01')).toBeInTheDocument();

    window.__env = { logLevel: 4, DEMI_PROJECTS_PATH: '' };
    await loadConfig();
  });

  it('shows only the decision date when DEMI has no certificate number', async () => {
    renderTab();

    const dateLine = await screen.findByText('March 14, 2023');
    expect(dateLine).toHaveClass('decisions-tab__decision-date');
  });

  it('links the EA decision to its newest certificate package document', async () => {
    certDocument = {
      _id: 'doc-cert',
      displayName: 'Certificate E23-01',
      documentFileName: 'Certificate E23-01.pdf',
      datePosted: '2023-03-14T00:00:00.000Z',
    };
    renderTab();

    const decisionCard = screen.getByText('Certificate Issued').closest('.decisions-tab__decision');
    expect(
      await within(decisionCard as HTMLElement).findByRole('link', {
        name: 'Certificate E23-01.pdf',
      }),
    ).toBeInTheDocument();
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

  it('marks the list busy while the decision documents are in flight, and says nothing about emptiness', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { container } = renderAt('/p/proj-1/decisions', [
      { path: '/p/:projId/decisions', element: <DecisionsTab /> },
    ]);

    expect(container.querySelector('.decisions-tab__list[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading decision documents')).toBeInTheDocument();
    expect(
      screen.queryByText('No decision documents have been posted for this project.'),
    ).not.toBeInTheDocument();
  });
});
