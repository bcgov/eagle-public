import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet } from 'react-router';
import { makeQueryClient, renderAt } from '../../../test-utils';
import { queryClient } from 'app/api/query-client';
import { logger } from 'app/config/logging';
import { json, native, stubFetch } from '../home/home-fetch.spec-helper';
import { track } from 'app/analytics/analytics';
import { DocumentsPage } from './documents-page';
import { ExtendedPageContext, useProjectContext, type ProjectContext } from './project-context';
import type { ExtendedPage } from './extended/types';

vi.mock('app/analytics/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/analytics/analytics')>()),
  track: vi.fn(),
}));

const LISTS = [
  { id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { id: 'type-memo-2002', name: 'Scientific Memo', legislation: 2002, type: 'doctype' },
  { id: 'type-memo-2018', name: 'Independent Memo', legislation: 2018, type: 'doctype' },
  { id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { id: 'ms-eac', name: 'EAC Application', legislation: 2018, type: 'label' },
  { id: 'ms-eac-rev', name: 'Revised EAC Application', legislation: 2018, type: 'label' },

  { id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },

  { id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  {
    id: 'ph-amend-2002',
    name: 'Post Decision - Amendment',
    legislation: 2002,
    type: 'projectPhase',
  },

  { id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
  { id: 'ms-ce-2018', name: 'Compliance & Enforcement', legislation: 2018, type: 'label' },

  { id: 'type-mp-2018', name: 'Management Plan', legislation: 2018, type: 'doctype' },
];

let requests: string[];
let probeResponse: (url: string) => Response;
let extendedPage: ExtendedPage | null;

/** The DEMI project behind `proj-1`, whose id the document reads carry. */
const DEMI_PROJECT = { id: 'track-1', eagleId: 'proj-1' };

const found = () => native([{ id: 'doc-1' }], 1);
const none = () => native([], 0);

function probeRequests(): string[] {
  return requests.filter((url) => url.startsWith('/demi/api/documents'));
}

const CONTEXT: ProjectContext = {
  project: { _id: 'proj-1', name: 'Cedar Quarry' } as ProjectContext['project'],
  projId: 'proj-1',
  basePath: '/p/proj-1',
  isNotification: false,
  lists: LISTS,
  projectLoading: false,
};

/** The Documents tab as the shell mounts it: outlet context in, sub-tab body out. */
function renderDocuments(path = '/p/proj-1/documents', retry: RetryOptions = {}) {
  requests = stubFetch((url) => {
    if (url === '/demi-projects/proj-1') return json(DEMI_PROJECT);
    if (url.startsWith('/demi/api/documents')) return probeResponse(url);
    return undefined;
  });

  return renderRouter(path, CONTEXT, retry);
}

interface RetryOptions {
  retry?: number | false;
  retryDelay?: number;
}

/** The same route tree, with whatever fetch stub the test installed. */
function renderRouter(
  path = '/p/proj-1/documents',
  context: ProjectContext = CONTEXT,
  { retry = false, retryDelay = 0 }: RetryOptions = {},
) {
  return renderAt(
    path,
    [
      {
        path: '/p/:projId',
        element: <ShellStub context={context} />,
        children: [
          {
            path: 'documents',
            Component: DocumentsPage,
            children: [
              { index: true, element: <div>all documents</div> },
              { path: 'application', element: <ContextProbe /> },
              { path: 'compliance', element: <div>compliance documents</div> },
              { path: 'certificates', element: <div>certificate documents</div> },
              { path: 'amendments', element: <div>amendment documents</div> },
              { path: 'management-plans', element: <div>management plan documents</div> },
            ],
          },
        ],
      },
    ],
    { queryClient: makeQueryClient({ retry, retryDelay }) },
  ).router;
}

/** Stands in for a document sub-tab, and proves the context reached it. */
function ContextProbe() {
  const { projId } = useProjectContext();
  return <div>application documents for {projId}</div>;
}

function ShellStub({ context }: { context: ProjectContext }) {
  return (
    <ExtendedPageContext.Provider value={extendedPage}>
      <Outlet context={context} />
    </ExtendedPageContext.Provider>
  );
}

/** The segmented control's links, by their accessible name. */
function segment(name: string) {
  return within(screen.getByRole('navigation', { name: 'Document type' })).getByRole('link', {
    name,
  });
}

function findSegment(name: string) {
  return within(screen.getByRole('navigation', { name: 'Document type' })).findByRole('link', {
    name,
  });
}

function querySegment(name: string) {
  return within(screen.getByRole('navigation', { name: 'Document type' })).queryByRole('link', {
    name,
  });
}

describe('documents page', () => {
  beforeEach(() => {
    probeResponse = none;
    extendedPage = null;
    // `readDocuments` caches the DEMI project lookup in the app-wide client.
    queryClient.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to All Documents when the lists never arrive', async () => {
    // A disabled TanStack query reports `isPending`, so keying the placeholders on that alone left
    // the control shimmering for good whenever the List fetch failed.
    const withoutLists = { ...CONTEXT, lists: [] };
    requests = stubFetch(() => undefined);

    renderRouter('/p/proj-1/documents', withoutLists);

    expect(await findSegment('All Documents')).toBeInTheDocument();
    expect(document.querySelector('.document-type-filter [aria-busy="true"]')).toBeNull();
    expect(querySegment('Compliance')).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('holds the group as placeholders until every probe has answered', async () => {
    // The probes resolve independently; rendering each answer as it lands makes the segments pop
    // in one at a time.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = decodeURIComponent(String(input));
        requests.push(url);
        if (url === '/demi-projects/proj-1') return json(DEMI_PROJECT);
        await gate;
        return found();
      }),
    );

    renderRouter();

    const group = await screen.findByRole('navigation', { name: 'Document type' });
    await waitFor(() => expect(probeRequests()).toHaveLength(5));
    expect(within(group).queryByRole('link')).not.toBeInTheDocument();
    expect(group.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading document types')).toBeInTheDocument();

    release();

    expect(await findSegment('Compliance')).toBeInTheDocument();
    expect(within(group).getAllByRole('link')).toHaveLength(6);
    expect(group.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('heads the tab and links out to the search help page', async () => {
    renderDocuments();

    expect(await screen.findByRole('heading', { name: 'Documents', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Search help/ })).toHaveAttribute(
      'href',
      '/search-help',
    );
  });

  it('always offers All Documents and hides the segments with no documents', async () => {
    renderDocuments();

    expect(await findSegment('All Documents')).toHaveAttribute('href', '/p/proj-1/documents');
    await waitFor(() => expect(probeRequests()).toHaveLength(5));
    expect(querySegment('Application')).not.toBeInTheDocument();
    expect(querySegment('Certificate')).not.toBeInTheDocument();
    expect(querySegment('Amendment(s)')).not.toBeInTheDocument();
    expect(querySegment('Compliance')).not.toBeInTheDocument();
    expect(querySegment('Management Plan')).not.toBeInTheDocument();
  });

  it('asks for one document per segment, filtered by that view type and milestone ids', async () => {
    renderDocuments();

    await waitFor(() => expect(probeRequests()).toHaveLength(5));

    expect(probeRequests().find((url) => url.includes('typeId=type-app-2002'))).toBe(
      '/demi/api/documents?page=1&pageSize=1&count=true' +
        '&documentSource=PROJECT' +
        '&typeId=type-app-2002&typeId=type-app-2018&typeId=type-memo-2002&typeId=type-memo-2018' +
        '&milestoneId=ms-appreview&milestoneId=ms-eac&milestoneId=ms-eac-rev' +
        '&project=track-1',
    );
  });

  it('probes for compliance documents by milestone, with no type filter', async () => {
    renderDocuments();

    await waitFor(() => expect(probeRequests()).toHaveLength(5));

    // An empty type filter would match nothing and hide the segment for good.
    expect(probeRequests().find((url) => url.includes('milestoneId=ms-ce-2002'))).toBe(
      '/demi/api/documents?page=1&pageSize=1&count=true' +
        '&documentSource=PROJECT&milestoneId=ms-ce-2002&milestoneId=ms-ce-2018&project=track-1',
    );
  });

  it('shows the Compliance segment once its search finds a document', async () => {
    probeResponse = (url) => (url.includes('milestoneId=ms-ce-2002') ? found() : none());

    renderDocuments();

    expect(await findSegment('Compliance')).toHaveAttribute(
      'href',
      '/p/proj-1/documents/compliance',
    );
    expect(querySegment('Certificate')).not.toBeInTheDocument();
  });

  it('shows the Management Plan segment once its search finds a document', async () => {
    probeResponse = (url) => (url.includes('typeId=type-mp-2018') ? found() : none());

    renderDocuments();

    const managementPlan = await findSegment('Management Plan');
    expect(managementPlan).toHaveAttribute('href', '/p/proj-1/documents/management-plans');
    // The type is the whole filter: no milestone, and no empty one to match nothing.
    const probe = probeRequests().find((url) => url.includes('typeId=type-mp-2018'));
    expect(probe).not.toContain('milestoneId');
    expect(querySegment('Compliance')).not.toBeInTheDocument();

    await userEvent.click(managementPlan);
    expect(await screen.findByText('management plan documents')).toBeInTheDocument();
  });

  it('leaves a segment hidden and logs when its read fails', async () => {
    // The segment must stay hidden, and the console must say which read failed.
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    probeResponse = (url) =>
      url.includes('typeId=type-amend-2002') ? new Response('', { status: 502 }) : found();

    renderDocuments();

    expect(await findSegment('Certificate')).toBeInTheDocument();
    expect(querySegment('Amendment(s)')).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/^HTTP GET \/demi\/api\/documents\?.*typeId=type-amend-2002.* 502$/),
      'api',
    );
  });

  it('retries a probe that hit a bad gateway instead of caching it as "no documents"', async () => {
    // One rproxy 502 must not hide a segment for the rest of the visit: the probe throws, TanStack
    // retries, and the segment appears once the retry answers.
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    let amendmentProbes = 0;
    probeResponse = (url) => {
      if (url.includes('type-amend-2002') && amendmentProbes++ === 0)
        return new Response('', { status: 502 });
      return found();
    };

    renderDocuments('/p/proj-1/documents', { retry: 1 });

    expect(await findSegment('Amendment(s)')).toBeInTheDocument();
    expect(amendmentProbes).toBe(2);
  });

  it('shows the settled segments while a failed probe waits to retry', async () => {
    // Production backoff is 1s/2s/4s. Holding every segment as a placeholder for that long would
    // hide All Documents behind one bad gateway.
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    probeResponse = (url) =>
      url.includes('type-amend-2002') ? new Response('', { status: 502 }) : found();

    renderDocuments('/p/proj-1/documents', { retry: 1, retryDelay: 5000 });

    expect(await findSegment('All Documents')).toBeInTheDocument();
    expect(segment('Certificate')).toBeInTheDocument();
    expect(querySegment('Amendment(s)')).not.toBeInTheDocument();
  });

  it('does not log when the search legitimately finds nothing', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    renderDocuments();

    await waitFor(() => expect(probeRequests()).toHaveLength(5));
    expect(error).not.toHaveBeenCalled();
  });

  it('marks only the open segment active, and passes the project context down to it', async () => {
    probeResponse = found;

    renderDocuments('/p/proj-1/documents/application');

    const application = await findSegment('Application');
    expect(application).toHaveClass('active');
    expect(segment('All Documents')).not.toHaveClass('active');
    // react-router does not inherit outlet context; the sub-tab only sees it because
    // DocumentsPage passes it on.
    expect(screen.getByText('application documents for proj-1')).toBeInTheDocument();
  });

  it('keeps segment links stable when moving between document views', async () => {
    // Relative links compound: from /documents/compliance a `compliance` link would resolve to
    // /documents/compliance/compliance, and `.` would leave All Documents active everywhere.
    probeResponse = found;

    renderDocuments();

    await userEvent.click(await findSegment('Compliance'));

    const compliance = await findSegment('Compliance');
    expect(compliance).toHaveAttribute('href', '/p/proj-1/documents/compliance');
    expect(compliance).toHaveClass('active');
    expect(segment('All Documents')).not.toHaveClass('active');
    expect(segment('Amendment(s)')).toHaveAttribute('href', '/p/proj-1/documents/amendments');
    expect(screen.getByText('compliance documents')).toBeInTheDocument();

    await userEvent.click(segment('All Documents'));
    expect(await screen.findByText('all documents')).toBeInTheDocument();
  });

  it('marks All Documents active only on the documents index', async () => {
    probeResponse = found;

    renderDocuments();

    const all = await findSegment('All Documents');
    expect(all).toHaveClass('active');
    expect(screen.getByText('all documents')).toBeInTheDocument();
  });

  it('sends the display name with a segment click on an extended page, as the tab strip does', async () => {
    extendedPage = { version: 1, displayName: 'Cedar Quarry Expansion' };

    renderDocuments();
    await userEvent.click(await findSegment('All Documents'));

    expect(track).toHaveBeenCalledWith(
      'Project Tab Clicked',
      expect.objectContaining({ project_name: 'Cedar Quarry Expansion' }),
    );
  });
});
