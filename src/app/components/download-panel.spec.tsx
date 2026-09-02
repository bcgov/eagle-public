import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BulkDownloadJob } from 'app/state/bulk-download';

const JOB_KEY = 'epic-bulk-download-job';
const ALPHA = { id: 'doc-a', displayName: 'Alpha' };
const BETA = { id: 'doc-b', displayName: 'Beta' };

let postResponse: () => Response;
let statusStatus: number;
let statusResponses: unknown[];
let fetchMock: ReturnType<typeof vi.fn>;

/** The src of every download iframe currently in the document. */
function downloadUrls(): string[] {
  return [...document.body.querySelectorAll('iframe')].map(frame => frame.getAttribute('src') ?? '');
}

/**
 * The panel is the only place the browser learns a zip is ready, so its states are driven end to
 * end here: the POST, the poll, and the hidden iframes that actually fetch the parts.
 */
describe('DownloadPanel', () => {
  const originalEnv = window.__env;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    statusResponses = [];
    statusStatus = 200;
    postResponse = () => new Response('{}', { status: 500 });

    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return postResponse();
      if (statusStatus !== 200) return new Response('{}', { status: statusStatus, statusText: 'Nope' });
      const body = statusResponses.length > 1 ? statusResponses.shift() : statusResponses[0];
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.__env = originalEnv;
    document.body.querySelectorAll('iframe').forEach(frame => frame.remove());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Fresh module state per test: the selection, the failed start and the persisted job are
   * module-level stores, and the job is rehydrated at import time.
   */
  async function mount(storedJob?: BulkDownloadJob) {
    if (storedJob) localStorage.setItem(JOB_KEY, JSON.stringify(storedJob));
    vi.resetModules();
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '/demi-search' };
    const config = await import('app/config/config');
    await config.loadConfig();
    const store = await import('app/state/bulk-download');
    const { DownloadPanel } = await import('./download-panel');

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return {
      store,
      render: () =>
        render(
          <QueryClientProvider client={client}>
            <DownloadPanel />
          </QueryClientProvider>
        )
    };
  }

  async function tick(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  /** What the toolbar's Download button does, from the state module both share. */
  async function startDownload(store: typeof import('app/state/bulk-download')): Promise<void> {
    await act(async () => {
      await store.startDownload();
    });
  }

  it('stays out of the way with no job and no failed start', async () => {
    const panel = await mount();

    const { container } = panel.render();

    expect(container).toBeEmptyDOMElement();
  });

  it('reports progress, then downloads every part of a finished job, one iframe each', async () => {
    postResponse = () =>
      new Response(JSON.stringify({ id: 'job-1', status: 'queued', documentCount: 2 }), { status: 202 });
    statusResponses = [
      { id: 'job-1', status: 'running', partCount: 2, partsReady: 1 },
      {
        id: 'job-1',
        status: 'ready',
        partCount: 2,
        partsReady: 2,
        includedCount: 2,
        errorCount: 0,
        parts: [
          { n: 1, fileName: 'documents-1.zip', url: 'https://nrs.example/part1.zip' },
          { n: 2, fileName: 'documents-2.zip', url: 'https://nrs.example/part2.zip' }
        ]
      }
    ];
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA, BETA]);
    panel.render();

    await startDownload(panel.store);
    await tick(0);

    expect(screen.getByText('Zipping 2 files…')).toBeInTheDocument();
    expect(screen.getByText('part 2 of 2')).toBeInTheDocument();

    // One poll interval later the job is ready and the first part goes.
    await tick(4000);
    // Two more turns of the clock: one for React to commit the ready status, one for the first
    // part's download, which the component schedules from that render.
    await tick(1);
    await tick(1);

    expect(screen.getByText('Downloading documents-1.zip')).toBeInTheDocument();
    expect(downloadUrls()).toEqual(['https://nrs.example/part1.zip']);

    // The next follows a second later, so the browser asks once to allow multiple downloads.
    await tick(1000);

    expect(downloadUrls()).toEqual(['https://nrs.example/part1.zip', 'https://nrs.example/part2.zip']);
    expect(screen.getByText('Downloading documents-2.zip')).toBeInTheDocument();
  });

  it('names the files the zip could not include', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 5,
        errorCount: 3,
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }]
      }
    ];
    const panel = await mount({ id: 'job-9', count: 8, startedAt: Date.now() });

    panel.render();
    await tick(0);

    expect(screen.getByText('Downloading documents.zip')).toBeInTheDocument();
    expect(screen.getByText('3 files could not be included (see errors.txt)')).toBeInTheDocument();
  });

  /**
   * Every document in the selection failed: the zip holds nothing but errors.txt, and each part
   * answers with an error page, so fetching them buys the reader nothing.
   */
  it('downloads nothing when the finished zip included no documents', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 0,
        errorCount: 2,
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }]
      }
    ];
    const panel = await mount({ id: 'job-9', count: 2, startedAt: Date.now() });

    panel.render();
    await tick(2000);

    expect(screen.getByText('None of the selected documents could be downloaded.')).toBeInTheDocument();
    expect(downloadUrls()).toEqual([]);
  });

  it('explains a 429 in the panel rather than looking like a failure', async () => {
    postResponse = () => new Response('{}', { status: 429, statusText: 'Too Many Requests' });
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA, BETA]);
    panel.render();

    await startDownload(panel.store);

    expect(screen.getByText("You've reached the download limit. Try again later.")).toBeInTheDocument();
    expect(downloadUrls()).toEqual([]);
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
  });

  it('says so when bulk download is switched off at the backend', async () => {
    postResponse = () => new Response('{}', { status: 503, statusText: 'Service Unavailable' });
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA, BETA]);
    panel.render();

    await startDownload(panel.store);

    expect(screen.getByText('Bulk download is not available right now.')).toBeInTheDocument();
  });

  it('shows any other failed start in the panel', async () => {
    postResponse = () => new Response('{}', { status: 500, statusText: 'Server Error' });
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA, BETA]);
    panel.render();

    await startDownload(panel.store);

    expect(screen.getByText('That download could not be started. Please try again.')).toBeInTheDocument();
  });

  it('takes the presigned URL straight away for a single document, with no job or panel', async () => {
    postResponse = () =>
      new Response(JSON.stringify({ url: 'https://nrs.example/one.pdf', single: true }), { status: 200 });
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA]);
    const { container } = panel.render();

    await startDownload(panel.store);

    expect(downloadUrls()).toEqual(['https://nrs.example/one.pdf']);
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('resumes a job left running by the previous page load', async () => {
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 3, partsReady: 2 }];
    const panel = await mount({ id: 'job-9', count: 40, startedAt: Date.now() - 60_000 });

    panel.render();
    await tick(0);

    expect(screen.getByText('Zipping 40 files…')).toBeInTheDocument();
    expect(screen.getByText('part 3 of 3')).toBeInTheDocument();
  });

  it('drops a job left over from more than an hour ago', async () => {
    const panel = await mount({ id: 'job-9', count: 40, startedAt: Date.now() - 3_700_000 });

    const { container } = panel.render();
    await tick(0);

    expect(container).toBeEmptyDOMElement();
  });

  it('says a failed job failed, with nothing to retry', async () => {
    statusResponses = [{ id: 'job-9', status: 'failed', partCount: 0, partsReady: 0 }];
    const panel = await mount({ id: 'job-9', count: 40, startedAt: Date.now() });

    panel.render();
    await tick(0);

    expect(screen.getByText('That download could not be completed. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  /**
   * A job id demi-api no longer knows - swept, expired, or left over from another environment -
   * used to pin the panel on "Zipping…" and poll for the rest of the hour.
   */
  it('drops a job the status endpoint answers 404 for, and stops polling', async () => {
    statusStatus = 404;
    const panel = await mount({ id: 'job-gone', count: 40, startedAt: Date.now() });

    panel.render();
    await tick(0);

    expect(screen.getByText('That download is no longer available.')).toBeInTheDocument();
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    const pollsSoFar = fetchMock.mock.calls.length;
    await tick(60_000);

    expect(fetchMock.mock.calls.length).toBe(pollsSoFar);
  });

  it('offers a retry when the status check fails for any other reason', async () => {
    statusStatus = 500;
    const panel = await mount({ id: 'job-9', count: 40, startedAt: Date.now() });

    panel.render();
    await tick(0);

    expect(screen.getByText('Could not check the download.')).toBeInTheDocument();
    // The job is still demi-api's, so it stays: a 500 says nothing about the zip.
    expect(localStorage.getItem(JOB_KEY)).not.toBeNull();

    // The 4s beat stops until the reader asks again, rather than hammering a failing endpoint.
    const pollsSoFar = fetchMock.mock.calls.length;
    await tick(60_000);

    expect(fetchMock.mock.calls.length).toBe(pollsSoFar);

    statusStatus = 200;
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 3, partsReady: 2 }];
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await tick(0);

    expect(screen.getByText('Zipping 40 files…')).toBeInTheDocument();
  });

  it('keeps polling while it is collapsed, and stops showing the rows', async () => {
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 1, partsReady: 0 }];
    const panel = await mount({ id: 'job-9', count: 4, startedAt: Date.now() });

    panel.render();
    await tick(0);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse download panel' }));

    expect(screen.queryByText('Zipping 4 files…')).not.toBeInTheDocument();
    const pollsSoFar = fetchMock.mock.calls.length;

    await tick(4000);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(pollsSoFar);

    fireEvent.click(screen.getByRole('button', { name: 'Expand download panel' }));

    expect(screen.getByText('Zipping 4 files…')).toBeInTheDocument();
  });

  it('forgets the job on close', async () => {
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 1, partsReady: 0 }];
    const panel = await mount({ id: 'job-9', count: 4, startedAt: Date.now() });
    const { container } = panel.render();
    await tick(0);

    fireEvent.click(screen.getByRole('button', { name: 'Close download panel' }));

    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem(JOB_KEY)).toBeNull();

    // Nothing left to poll for: the job is gone, not just hidden.
    const pollsSoFar = fetchMock.mock.calls.length;
    await tick(60_000);

    expect(fetchMock.mock.calls.length).toBe(pollsSoFar);
  });
  /**
   * The panel is fixed over the bottom-right of the page. Without the body padding it sits on top
   * of the pagination, the page-size picker and the footer links, which is where the reader is
   * heading next.
   */
  it('keeps the page clear of the panel while it shows, and gives the space back on close', async () => {
    const height = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(120);
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 1, partsReady: 0 }];
    const panel = await mount({ id: 'job-9', count: 4, startedAt: Date.now() });
    panel.render();
    await tick(0);

    // The panel's own height plus the 1rem it sits above the bottom of the viewport.
    expect(document.body.style.paddingBottom).toBe('136px');

    fireEvent.click(screen.getByRole('button', { name: 'Close download panel' }));

    expect(document.body.style.paddingBottom).toBe('');
    height.mockRestore();
  });

  /** The toolbar's Download is disabled while a job runs; a finished job must release it. */
  it('records the job status so a finished download stops blocking the next one', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 2,
        errorCount: 0,
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }]
      }
    ];
    const panel = await mount({ id: 'job-9', count: 2, startedAt: Date.now() });
    panel.render();
    await tick(0);

    expect(JSON.parse(localStorage.getItem(JOB_KEY) ?? '{}').status).toBe('ready');
  });
});
