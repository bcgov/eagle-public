import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearSelection } from 'app/state/bulk-download';
import { clearToasts } from 'app/state/toast';
import { renderAt } from '../../../test-utils';
import { Amendments } from './amendments';
import { Application } from './application';
import { ManagementPlans } from './management-plans';
import { Certificates } from './certificates';
import { DocumentsTab } from './documents-tab';
import { queryClient } from 'app/api/query-client';
import { nativeDocument } from 'app/models/demi/document.fixture';
import { json, native, stubFetch } from '../home/home-fetch.spec-helper';

const LISTS = [
  { id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { id: 'type-memo-2002', name: 'Scientific Memo', legislation: 2002, type: 'doctype' },
  { id: 'type-memo-2018', name: 'Independent Memo', legislation: 2018, type: 'doctype' },
  { id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { id: 'ms-eac', name: 'EAC Application', legislation: 2018, type: 'label' },
  { id: 'ms-eac-rev', name: 'Revised EAC Application', legislation: 2018, type: 'label' },

  { id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
  { id: 'type-order-2002', name: 'Order', legislation: 2002, type: 'doctype' },
  { id: 'type-order-2018', name: 'Order', legislation: 2018, type: 'doctype' },
  { id: 'type-dm-2002', name: 'Decision Materials', legislation: 2002, type: 'doctype' },
  { id: 'type-dm-2018', name: 'Decision Materials', legislation: 2018, type: 'doctype' },
  { id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },
  { id: 'ms-certdec-2018', name: 'Certificate Decision', legislation: 2018, type: 'label' },
  { id: 'ms-decision-2002', name: 'Decision', legislation: 2002, type: 'label' },
  { id: 'ms-certext-2002', name: 'Certificate Extension', legislation: 2002, type: 'label' },
  { id: 'ms-certext-2018', name: 'Certificate Extension', legislation: 2018, type: 'label' },
  {
    id: 'ms-transfer-2018',
    name: 'Transfer of Certificate/Order',
    legislation: 2018,
    type: 'label',
  },

  { id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { id: 'type-amend-2018', name: 'Amendment Package', legislation: 2018, type: 'doctype' },
  { id: 'type-req-2002', name: 'Request', legislation: 2002, type: 'doctype' },
  { id: 'type-tt-2002', name: 'Tracking Table', legislation: 2002, type: 'doctype' },
  { id: 'type-tt-2018', name: 'Tracking Table', legislation: 2018, type: 'doctype' },
  { id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  { id: 'ms-amend-2018', name: 'Amendment', legislation: 2018, type: 'label' },
  {
    id: 'ph-amend-2002',
    name: 'Post Decision - Amendment',
    legislation: 2002,
    type: 'projectPhase',
  },
  {
    id: 'ph-amend-2018',
    name: 'Post Decision - Amendment',
    legislation: 2018,
    type: 'projectPhase',
  },

  { id: 'type-mp-2018', name: 'Management Plan', legislation: 2018, type: 'doctype' },
  { id: 'type-plan-2002', name: 'Plan', legislation: 2002, type: 'doctype' },

  { id: 'author-eao', name: 'EAO', legislation: 2018, type: 'author' },
];

const DOCUMENTS = [
  {
    _id: 'doc-1',
    displayName: 'Cedar Quarry Certificate',
    documentFileName: 'cert.pdf',
    datePosted: '2026-05-01T00:00:00.000Z',
    type: 'type-cert-2018',
    milestone: 'ms-cert-2002',
    projectPhase: 'ph-amend-2018',
    isFeatured: true,
    internalSize: String(2 * 1024 * 1024),
  },
];

let requests: string[];
let total = 1;

function renderTab(Tab: () => React.ReactNode, path: string) {
  requests = stubFetch((url) => {
    if (url.startsWith('/demi/api/lists')) return native(LISTS);
    if (url === '/demi-projects/proj-1') return json({ id: 'track-1', eagleId: 'proj-1' });
    if (url.startsWith('/demi/api/documents')) {
      return native(total > 0 ? DOCUMENTS.map(nativeDocument) : [], total);
    }
    return undefined;
  });

  return renderAt(path, [{ path: '/p/:projId/:tab', element: <Tab /> }]).router;
}

function documentRequests(): string[] {
  return requests.filter((url) => url.startsWith('/demi/api/documents'));
}

/** The phone width the grid draws cards at; jsdom answers every media query false without this. */
function stubNarrow() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

/** The card a document gets instead of a row at phone width. */
function cardFor(title: string): HTMLElement {
  return screen.getByRole('heading', { name: title, level: 3 }).closest('li') as HTMLElement;
}

// The tabs read their project id and lists off the shell's outlet context; the tests render each
// tab on its own, so the context comes from a stub instead.
vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({ project: null, projId: 'proj-1', lists: LISTS }),
  };
});

describe('project document tabs', () => {
  beforeEach(() => {
    requests = [];
    total = 1;
    clearSelection();
    clearToasts();
    // `readDocuments` caches the DEMI project lookup in the app-wide client.
    queryClient.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('certificates asks for certificate documents of the DEMI project, newest first', async () => {
    renderTab(Certificates, '/p/proj-1/certificates');

    expect(await screen.findByText('Cedar Quarry Certificate')).toBeInTheDocument();
    expect(documentRequests().at(-1)).toBe(
      '/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted' +
        '&documentSource=PROJECT' +
        '&typeId=type-cert-2002&typeId=type-cert-2018&typeId=type-order-2002&typeId=type-order-2018' +
        '&typeId=type-dm-2002&typeId=type-dm-2018' +
        '&milestoneId=ms-cert-2002&milestoneId=ms-certdec-2018&milestoneId=ms-decision-2002' +
        '&milestoneId=ms-certext-2002&milestoneId=ms-certext-2018&milestoneId=ms-transfer-2018' +
        '&project=track-1',
    );
  });

  it('certificates renders no filter panel', async () => {
    renderTab(Certificates, '/p/proj-1/certificates');

    await screen.findByText('Cedar Quarry Certificate');
    expect(screen.queryByRole('button', { name: /Filters/ })).not.toBeInTheDocument();
  });

  it('certificates renders the document row without a featured star', async () => {
    renderTab(Certificates, '/p/proj-1/certificates');

    await screen.findByText('Cedar Quarry Certificate');
    expect(screen.queryByRole('img', { name: 'Featured' })).not.toBeInTheDocument();
    // Ids are resolved to list names for display.
    expect(screen.getByRole('cell', { name: 'Certificate Package' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Certificate' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Post Decision - Amendment' })).toBeInTheDocument();
  });

  it('tints the phase pill with the stage colour for that phase', async () => {
    renderTab(Certificates, '/p/proj-1/certificates');

    await screen.findByText('Cedar Quarry Certificate');
    expect(screen.getByText('Post Decision - Amendment')).toHaveStyle({
      background: 'var(--eao-amendment-light)',
    });
  });

  it('certificates shows its own empty message', async () => {
    total = 0;
    renderTab(Certificates, '/p/proj-1/certificates');

    expect(
      await screen.findByText('There are no certificate documents associated with this project.'),
    ).toBeInTheDocument();
  });

  it('amendments asks for amendment documents and offers the filter panel', async () => {
    renderTab(Amendments, '/p/proj-1/amendments');

    expect(await screen.findByText('Cedar Quarry Certificate')).toBeInTheDocument();
    expect(documentRequests().at(-1)).toBe(
      '/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted' +
        '&documentSource=PROJECT' +
        '&typeId=type-amend-2002&typeId=type-amend-2018&typeId=type-req-2002&typeId=type-dm-2002' +
        '&typeId=type-dm-2018&typeId=type-tt-2002&typeId=type-tt-2018' +
        '&milestoneId=ms-amend-2002&milestoneId=ms-amend-2018' +
        '&projectPhaseId=ph-amend-2002&projectPhaseId=ph-amend-2018' +
        '&project=track-1',
    );
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('amendments flips the filters toggle open on click', async () => {
    renderTab(Amendments, '/p/proj-1/amendments');

    await screen.findByText('Cedar Quarry Certificate');
    const toggle = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('management plans ask for the management plan type, with no milestone', async () => {
    renderTab(ManagementPlans, '/p/proj-1/management-plans');

    expect(await screen.findByText('Cedar Quarry Certificate')).toBeInTheDocument();
    expect(documentRequests().at(-1)).toBe(
      '/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted' +
        '&documentSource=PROJECT&typeId=type-mp-2018&project=track-1',
    );
  });

  it('management plans show their own empty message', async () => {
    total = 0;
    renderTab(ManagementPlans, '/p/proj-1/management-plans');

    expect(
      await screen.findByText(
        'There are no management plan documents associated with this project.',
      ),
    ).toBeInTheDocument();
  });

  it('management plans offer the filter panel with milestone and project phase, no document type', async () => {
    renderTab(ManagementPlans, '/p/proj-1/management-plans');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const panel = document.querySelector('#advancedFilterPanel') as HTMLElement;
    expect(within(panel).getByText('Milestone')).toBeInTheDocument();
    expect(within(panel).getByText('Project Phase')).toBeInTheDocument();
    expect(within(panel).queryByText('Document Type')).not.toBeInTheDocument();
  });

  /* A picked milestone narrows the tab's own milestones to that one, rather than adding to them;
     the keyword asks DEMI for its best-match order, so no sort goes with it. */
  it('application carries the URL keywords and filters into the request', async () => {
    renderTab(
      Application,
      '/p/proj-1/application?keywords=slope&milestone=ms-eac&projectPhase=ph-amend-2018&sortBy=-score',
    );

    await screen.findByText('Cedar Quarry Certificate');
    expect(documentRequests().at(-1)).toBe(
      '/demi/api/documents?page=1&pageSize=10&count=true&q=slope' +
        '&documentSource=PROJECT' +
        '&typeId=type-app-2002&typeId=type-app-2018&typeId=type-memo-2002&typeId=type-memo-2018' +
        '&milestoneId=ms-eac&projectPhaseId=ph-amend-2018' +
        '&project=track-1',
    );
  });

  it('application opens the filter panel when the URL already carries a filter', async () => {
    renderTab(Application, '/p/proj-1/application?projectPhase=ph-amend-2018');

    await screen.findByText('Cedar Quarry Certificate');
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('documents asks for every project document, with a featured star', async () => {
    renderTab(DocumentsTab, '/p/proj-1/documents');

    expect(await screen.findByText('Cedar Quarry Certificate')).toBeInTheDocument();
    expect(documentRequests().at(-1)).toBe(
      '/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted&project=track-1',
    );
    expect(screen.getByRole('img', { name: 'Featured' })).toBeInTheDocument();
  });

  it('documents send the URL filters under DEMI names, the posted date as one day', async () => {
    renderTab(
      DocumentsTab,
      '/p/proj-1/documents?documentAuthorType=author-eao&type=type-memo-2002,type-memo-2018' +
        '&datePostedStart=2026-01-01T08:00:00.000Z',
    );

    await screen.findByText('Cedar Quarry Certificate');
    expect(documentRequests().at(-1)).toBe(
      '/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted' +
        '&documentAuthorTypeId=author-eao&typeId=type-memo-2002&typeId=type-memo-2018' +
        '&datePostedStart=2026-01-01&project=track-1',
    );
  });

  it('documents restarts at page one when a column is sorted', async () => {
    const router = renderTab(DocumentsTab, '/p/proj-1/documents?currentPage=3');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(
      within(screen.getByRole('columnheader', { name: 'Date' })).getByRole('button'),
    );

    await waitFor(() => expect(router.state.location.search).toContain('currentPage=1'));
    expect(router.state.location.search).toContain('sortBy=%2BdatePosted');
  });

  it('sorting a column that was not sorted starts ascending', async () => {
    const router = renderTab(DocumentsTab, '/p/proj-1/documents');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(
      within(screen.getByRole('columnheader', { name: 'Name' })).getByRole('button'),
    );

    await waitFor(() => expect(router.state.location.search).toContain('sortBy=%2BdisplayName'));
    await waitFor(() =>
      expect(documentRequests().at(-1)).toBe(
        '/demi/api/documents?page=1&pageSize=10&count=true&sort=displayName&project=track-1',
      ),
    );
  });

  /* DEMI sorts by date and name only, so a Type click lists newest first rather than failing. */
  it('documents list newest first when sorted by a column DEMI cannot sort', async () => {
    const router = renderTab(DocumentsTab, '/p/proj-1/documents?sortBy=-displayName');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(
      within(screen.getByRole('columnheader', { name: 'Type' })).getByRole('button'),
    );

    await waitFor(() => expect(router.state.location.search).toContain('sortBy=%2Btype'));
    await waitFor(() =>
      expect(documentRequests().at(-1)).toBe(
        '/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted&project=track-1',
      ),
    );
  });

  it('counts the documents in the bar until a row is selected', async () => {
    total = 42;
    renderTab(DocumentsTab, '/p/proj-1/documents');

    await screen.findByText('Cedar Quarry Certificate');
    // The grid draws a second live region for the wait, so match the count by its own words.
    expect(screen.getByText('1–10 of 42 documents')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select all on this page'));

    expect(screen.getByLabelText('Select Cedar Quarry Certificate')).toBeChecked();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  /** The size is what a reader decides on before starting a download, so it sits on the button. */
  it('puts the estimated size of the selection on the Download button', async () => {
    renderTab(DocumentsTab, '/p/proj-1/documents');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(screen.getByLabelText('Select Cedar Quarry Certificate'));

    expect(screen.getByRole('button', { name: 'Download 1 (about 2.0 MB)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(screen.getByLabelText('Select Cedar Quarry Certificate')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /^Download/ })).not.toBeInTheDocument();
  });

  it('selects every matching document in one request, past the page on screen', async () => {
    total = 42;
    renderTab(DocumentsTab, '/p/proj-1/documents?currentPage=2&keywords=slope&sortBy=-score');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(screen.getByLabelText('Select Cedar Quarry Certificate'));
    await userEvent.click(screen.getByRole('button', { name: 'Select all 42 documents' }));

    await waitFor(() =>
      expect(documentRequests().at(-1)).toBe(
        '/demi/api/documents?page=1&pageSize=100&count=true&q=slope&project=track-1',
      ),
    );
  });

  it('offers the download limit rather than a total no click could select', async () => {
    total = 250;
    renderTab(DocumentsTab, '/p/proj-1/documents');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(screen.getByLabelText('Select Cedar Quarry Certificate'));

    expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select 100 (download limit)' })).toBeInTheDocument();
  });

  it('documents keeps the chosen page size when a keyword search runs', async () => {
    const router = renderTab(DocumentsTab, '/p/proj-1/documents?pageSize=50');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.type(screen.getByPlaceholderText('Type keyword to search'), 'slope{Enter}');

    await waitFor(() => expect(router.state.location.search).toContain('keywords=slope'));
    expect(router.state.location.search).toContain('pageSize=50');
    expect(router.state.location.search).toContain('sortBy=-score');
    await waitFor(() =>
      expect(documentRequests().at(-1)).toBe(
        '/demi/api/documents?page=1&pageSize=50&count=true&q=slope&project=track-1',
      ),
    );
  });

  describe('at phone width, where the rows are cards', () => {
    /** The star has no cell on a card, so the card says the same thing in words. */
    it('documents name a featured document in the card', async () => {
      stubNarrow();
      renderTab(DocumentsTab, '/p/proj-1/documents');

      await screen.findByText('Cedar Quarry Certificate');
      const card = cardFor('Cedar Quarry Certificate');

      expect(within(card).getByText('Featured')).toBeInTheDocument();
      expect(within(card).getByText('Yes')).toBeInTheDocument();
    });

    it('certificates leave the featured mark off the card, as they leave off the star', async () => {
      stubNarrow();
      renderTab(Certificates, '/p/proj-1/certificates');

      await screen.findByText('Cedar Quarry Certificate');

      expect(
        within(cardFor('Cedar Quarry Certificate')).queryByText('Featured'),
      ).not.toBeInTheDocument();
    });

    /* The select names a direction outright, unlike a heading, whose click can only flip the one
       in force: picking Name Z–A while the documents are newest first must not read A–Z. */
    it('documents sort the way the select names, not the flip of the sort in force', async () => {
      stubNarrow();
      const router = renderTab(DocumentsTab, '/p/proj-1/documents');

      await screen.findByText('Cedar Quarry Certificate');
      expect(screen.getByLabelText('Sort')).toHaveValue('-datePosted');

      await userEvent.selectOptions(screen.getByLabelText('Sort'), '-displayName');

      await waitFor(() => expect(router.state.location.search).toContain('sortBy=-displayName'));
      expect(router.state.location.search).toContain('currentPage=1');
    });
  });
});
