import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '../../test-utils';
import type { BulkDownloadJob } from 'app/state/bulk-download';

const ALPHA = { id: 'doc-a', displayName: 'Alpha' };
const BETA = { id: 'doc-b', displayName: 'Beta' };

let postResponse: () => Response;
let statusStatus: number;
let statusResponses: unknown[];
/** Status bodies for a named job, for the tests that run more than one at a time. */
let statusByJob: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;

/** Every job id the panel asked demi-api to cancel, in order. */
function cancelledIds(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')
    .map(([url]) => String(url).replace('/demi-search/bulk-downloads/', ''));
}

/** Dispatches a leave event, returning it so the caller can read what the panel did with it. */
function leave(type: 'beforeunload' | 'pagehide'): Event {
  const event = new Event(type, { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

/** The src of every download iframe currently in the document. */
function downloadUrls(): string[] {
  return [...document.body.querySelectorAll('iframe')].map(
    (frame) => frame.getAttribute('src') ?? '',
  );
}

/**
 * The panel is the only place the browser learns a zip is ready, so its states are driven end to
 * end here: the POST, the poll, and the hidden iframes that actually fetch the parts.
 */
describe('DownloadPanel', () => {
  const originalEnv = window.__env;

  beforeEach(() => {
    vi.useFakeTimers();
    // Accepted by default: most close-panel tests here have a job in flight and expect the
    // existing cancel-and-close path, not a dialog to also drive.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    statusResponses = [];
    statusByJob = {};
    statusStatus = 200;
    postResponse = () => new Response('{}', { status: 500 });

    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return postResponse();
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (statusStatus !== 200)
        return new Response('{}', { status: statusStatus, statusText: 'Nope' });
      const named = Object.keys(statusByJob).find((id) => url.includes(id));
      const body = named
        ? statusByJob[named]
        : statusResponses.length > 1
          ? statusResponses.shift()
          : statusResponses[0];
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.__env = originalEnv;
    document.body.querySelectorAll('iframe').forEach((frame) => frame.remove());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Fresh module state per test: the selection, the failed start and the job list are module-level
   * stores. Jobs are seeded oldest first, so the panel holds them in the order given.
   */
  async function mount(...initialJobs: BulkDownloadJob[]) {
    vi.resetModules();
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '/demi-search' };
    const config = await import('app/config/config');
    await config.loadConfig();
    const store = await import('app/state/bulk-download');
    [...initialJobs].reverse().forEach((job) => store.addJob(job));
    const { DownloadPanel } = await import('./download-panel');

    const client = makeQueryClient();
    return {
      store,
      render: () =>
        render(
          <QueryClientProvider client={client}>
            <DownloadPanel />
          </QueryClientProvider>,
        ),
    };
  }

  async function tick(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  /** How many times the status of one job has been asked for. */
  function pollsFor(jobId: string): number {
    return fetchMock.mock.calls.filter(([url]) => String(url).includes(jobId)).length;
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
      new Response(JSON.stringify({ id: 'job-1', status: 'queued', documentCount: 2 }), {
        status: 202,
      });
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
          { n: 2, fileName: 'documents-2.zip', url: 'https://nrs.example/part2.zip' },
        ],
      },
    ];
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA, BETA]);
    panel.render();

    await startDownload(panel.store);
    await tick(0);

    expect(screen.getByText('Zipping 2 documents…')).toBeInTheDocument();
    expect(screen.getByText('part 2 of 2')).toBeInTheDocument();

    // One poll interval later the job is ready and the first part goes.
    await tick(4000);
    // Two more turns of the clock: one for React to commit the ready status, one for the first
    // part's download, which the component schedules from that render.
    await tick(1);
    await tick(1);

    expect(screen.getByText('documents-1.zip')).toBeInTheDocument();
    expect(downloadUrls()).toEqual(['https://nrs.example/part1.zip']);

    // The next follows a second later, so the browser asks once to allow multiple downloads.
    await tick(1000);

    expect(downloadUrls()).toEqual([
      'https://nrs.example/part1.zip',
      'https://nrs.example/part2.zip',
    ]);
    expect(screen.getByText('documents-2.zip')).toBeInTheDocument();
  });

  it('names every document the zip could not include, and still downloads the parts', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 2,
        partsReady: 2,
        includedCount: 5,
        errorCount: 3,
        parts: [
          { n: 1, fileName: 'documents-1.zip', url: 'https://nrs.example/part1.zip' },
          { n: 2, fileName: 'documents-2.zip', url: 'https://nrs.example/part2.zip' },
        ],
        errors: [
          { documentId: 'doc-a', name: 'Alpha report.pdf', reason: 'not found' },
          { documentId: 'doc-b', name: 'Beta appendix.pdf', reason: 'too large' },
          { documentId: 'doc-c', name: '', reason: 'unreadable' },
        ],
      },
    ];
    const panel = await mount({ id: 'job-9', count: 8, startedAt: Date.now() });

    panel.render();
    await tick(2000);

    expect(screen.getByText('3 documents could not be included:')).toBeInTheDocument();
    expect(screen.getByText('Alpha report.pdf')).toBeInTheDocument();
    expect(screen.getByText('Beta appendix.pdf')).toBeInTheDocument();
    // demi-api sent no name, so the id is all the reader has to go on.
    expect(screen.getByText('doc-c')).toBeInTheDocument();
    expect(screen.getByText('documents-1.zip')).toBeInTheDocument();
    expect(downloadUrls()).toEqual([
      'https://nrs.example/part1.zip',
      'https://nrs.example/part2.zip',
    ]);
  });

  it('shows no list when every selected document made it into the zip', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 2,
        errorCount: 0,
        errors: [],
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }],
      },
    ];
    const panel = await mount({ id: 'job-9', count: 2, startedAt: Date.now() });

    panel.render();
    await tick(2000);

    expect(screen.getByText('documents.zip')).toBeInTheDocument();
    expect(screen.queryByText(/could not be included/)).not.toBeInTheDocument();
    expect(document.querySelector('.download-panel__names')).toBeNull();
  });

  /**
   * Every document in the selection failed: the zip holds nothing but errors.txt, and each part
   * answers with an error page, so fetching them buys the reader nothing.
   */
  it('downloads nothing when the finished zip included no documents, and names them all', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 0,
        errorCount: 2,
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }],
        errors: [
          { documentId: 'doc-a', name: 'Alpha report.pdf', reason: 'not found' },
          { documentId: 'doc-b', name: 'Beta appendix.pdf', reason: 'not found' },
        ],
      },
    ];
    const panel = await mount({ id: 'job-9', count: 2, startedAt: Date.now() });

    panel.render();
    await tick(2000);

    expect(
      screen.getByText('None of the selected documents could be downloaded.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Alpha report.pdf')).toBeInTheDocument();
    expect(screen.getByText('Beta appendix.pdf')).toBeInTheDocument();
    expect(downloadUrls()).toEqual([]);
    // No zip is fetched, so there is no errors.txt for the reader to open.
    expect(screen.queryByText(/errors\.txt/)).not.toBeInTheDocument();
  });

  /** demi-api caps errors[] at 100, so the names can be a short version of the true count. */
  it('says how many failures it could not name', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 4,
        errorCount: 5,
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }],
        errors: [
          { documentId: 'doc-a', name: 'Alpha report.pdf', reason: 'not found' },
          { documentId: 'doc-b', name: 'Beta appendix.pdf', reason: 'too large' },
          { documentId: 'doc-c', name: 'Gamma map.pdf', reason: 'unreadable' },
        ],
      },
    ];
    const panel = await mount({ id: 'job-9', count: 9, startedAt: Date.now() });

    panel.render();
    await tick(2000);

    expect(screen.getByText('5 documents could not be included:')).toBeInTheDocument();
    expect(screen.getByText('and 2 more')).toBeInTheDocument();
    expect(document.querySelectorAll('.download-panel__names li')).toHaveLength(3);
  });

  it('counts the failures with no list when demi-api names none of them', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 4,
        errorCount: 2,
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }],
      },
    ];
    const panel = await mount({ id: 'job-9', count: 6, startedAt: Date.now() });

    panel.render();
    await tick(2000);

    // A colon with nothing after it reads as a page that failed to finish rendering.
    expect(screen.getByText('2 documents could not be included.')).toBeInTheDocument();
    expect(document.querySelector('.download-panel__names')).toBeNull();
    expect(screen.queryByText(/and \d+ more/)).not.toBeInTheDocument();
  });

  it('explains a 429 in the panel rather than looking like a failure', async () => {
    postResponse = () => new Response('{}', { status: 429, statusText: 'Too Many Requests' });
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA, BETA]);
    panel.render();

    await startDownload(panel.store);

    expect(
      screen.getByText("You've reached the download limit. Try again later."),
    ).toBeInTheDocument();
    expect(downloadUrls()).toEqual([]);
    expect(document.querySelectorAll('.download-panel__job')).toHaveLength(0);
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

    expect(
      screen.getByText('That download could not be started. Please try again.'),
    ).toBeInTheDocument();
  });

  it('takes the presigned URL straight away for a single document, with no job or panel', async () => {
    postResponse = () =>
      new Response(JSON.stringify({ url: 'https://nrs.example/one.pdf', single: true }), {
        status: 200,
      });
    const panel = await mount();
    panel.store.setSelected('documents', [ALPHA]);
    const { container } = panel.render();

    await startDownload(panel.store);

    expect(downloadUrls()).toEqual(['https://nrs.example/one.pdf']);
    expect(container).toBeEmptyDOMElement();
  });

  it('reports the progress of a job it is holding', async () => {
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 3, partsReady: 2 }];
    const panel = await mount({ id: 'job-9', count: 40, startedAt: Date.now() - 60_000 });

    panel.render();
    await tick(0);

    expect(screen.getByText('Zipping 40 documents…')).toBeInTheDocument();
    expect(screen.getByText('part 3 of 3')).toBeInTheDocument();
  });

  it('says a failed job failed, with nothing to retry', async () => {
    statusResponses = [{ id: 'job-9', status: 'failed', partCount: 0, partsReady: 0 }];
    const panel = await mount({ id: 'job-9', count: 40, startedAt: Date.now() });

    panel.render();
    await tick(0);

    expect(
      screen.getByText('That download could not be completed. Please try again.'),
    ).toBeInTheDocument();
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
    expect(document.querySelectorAll('.download-panel__job')).toHaveLength(1);

    // The 4s beat stops until the reader asks again, rather than hammering a failing endpoint.
    const pollsSoFar = fetchMock.mock.calls.length;
    await tick(60_000);

    expect(fetchMock.mock.calls.length).toBe(pollsSoFar);

    statusStatus = 200;
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 3, partsReady: 2 }];
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await tick(0);

    expect(screen.getByText('Zipping 40 documents…')).toBeInTheDocument();
  });

  /** Three jobs demi-api no longer knows are three jobs it is no longer preparing. */
  it('releases the next download when the status poll answers 404', async () => {
    statusStatus = 404;
    const panel = await mount(
      { id: 'job-a', count: 4, startedAt: Date.now() },
      { id: 'job-b', count: 7, startedAt: Date.now() },
      { id: 'job-c', count: 9, startedAt: Date.now() },
    );

    panel.render();
    await tick(0);

    expect(renderHook(() => panel.store.useDownloadInProgress()).result.current).toBe(false);
    expect(leave('beforeunload').defaultPrevented).toBe(false);
    // The panel keeps the failure it read.
    expect(screen.getAllByText('That download is no longer available.')).toHaveLength(3);
  });

  /**
   * A 500 says nothing about the zip: demi-api is still building it, so the job stays in flight
   * and everything that protects it stays on.
   */
  it('keeps the jobs in flight when the status poll fails for any other reason', async () => {
    statusStatus = 500;
    const panel = await mount(
      { id: 'job-a', count: 4, startedAt: Date.now() },
      { id: 'job-b', count: 7, startedAt: Date.now() },
      { id: 'job-c', count: 9, startedAt: Date.now() },
    );

    panel.render();
    await tick(0);

    expect(renderHook(() => panel.store.useDownloadInProgress()).result.current).toBe(true);
    expect(leave('beforeunload').defaultPrevented).toBe(true);
    expect(screen.getAllByText('Could not check the download.')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss download of 4 documents' }));

    expect(cancelledIds()).toEqual(['job-a']);
  });

  it('keeps polling while it is collapsed, and stops showing the rows', async () => {
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 1, partsReady: 0 }];
    const panel = await mount({ id: 'job-9', count: 4, startedAt: Date.now() });

    panel.render();
    await tick(0);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse download panel' }));

    expect(screen.queryByText('Zipping 4 documents…')).not.toBeInTheDocument();
    const pollsSoFar = fetchMock.mock.calls.length;

    await tick(4000);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(pollsSoFar);

    fireEvent.click(screen.getByRole('button', { name: 'Expand download panel' }));

    expect(screen.getByText('Zipping 4 documents…')).toBeInTheDocument();
  });

  it('forgets the job on close', async () => {
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 1, partsReady: 0 }];
    const panel = await mount({ id: 'job-9', count: 4, startedAt: Date.now() });
    const { container } = panel.render();
    await tick(0);

    fireEvent.click(screen.getByRole('button', { name: 'Close download panel' }));

    expect(container).toBeEmptyDOMElement();

    // Nothing left to poll for: the job is gone, not just hidden.
    const pollsSoFar = fetchMock.mock.calls.length;
    await tick(60_000);

    expect(fetchMock.mock.calls.length).toBe(pollsSoFar);
  });
  /**
   * demi-api names the zip after the project, so the panel renders `fileName` as it comes. Once the
   * one automatic download has gone, the row offers it again rather than firing a second copy.
   */
  it('marks the job downloaded, names the part and offers it again on demand', async () => {
    statusResponses = [
      {
        id: 'job-9',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        includedCount: 2,
        errorCount: 0,
        parts: [
          {
            n: 1,
            fileName: 'EPIC documents - Site C Clean Energy.zip',
            url: 'https://nrs.example/part1.zip',
          },
        ],
      },
    ];
    const panel = await mount({ id: 'job-9', count: 2, startedAt: Date.now() });
    panel.render();
    await tick(2000);

    expect(screen.getByText('EPIC documents - Site C Clean Energy.zip')).toBeInTheDocument();
    expect(screen.getByText('Downloaded')).toBeInTheDocument();
    expect(downloadUrls()).toEqual(['https://nrs.example/part1.zip']);
    expect(renderHook(() => panel.store.useJobs()).result.current[0].downloadedAt).toEqual(
      expect.any(Number),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Download again EPIC documents - Site C Clean Energy.zip',
      }),
    );

    expect(downloadUrls()).toEqual([
      'https://nrs.example/part1.zip',
      'https://nrs.example/part1.zip',
    ]);
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
        parts: [{ n: 1, fileName: 'documents.zip', url: 'https://nrs.example/part1.zip' }],
      },
    ];
    const panel = await mount({ id: 'job-9', count: 2, startedAt: Date.now() });
    panel.render();
    await tick(0);

    expect(renderHook(() => panel.store.useJobs()).result.current[0].status).toBe('ready');
  });
  /**
   * demi-api takes three jobs at once, so the panel holds a group per job: each one polls, reports
   * and is dismissed on its own.
   */
  describe('with several jobs', () => {
    const RUNNING = (id: string, partsReady: number) => ({
      id,
      status: 'running',
      partCount: 2,
      partsReady,
    });

    async function twoJobs() {
      statusByJob = { 'job-a': RUNNING('job-a', 0), 'job-b': RUNNING('job-b', 1) };
      const panel = await mount(
        { id: 'job-a', count: 4, startedAt: Date.now() },
        { id: 'job-b', count: 7, startedAt: Date.now() },
      );
      panel.render();
      await tick(0);
      return panel;
    }

    it('renders a group for each job', async () => {
      await twoJobs();

      expect(screen.getByText('Zipping 4 documents…')).toBeInTheDocument();
      expect(screen.getByText('Zipping 7 documents…')).toBeInTheDocument();
      expect(document.querySelectorAll('.download-panel__job')).toHaveLength(2);
      expect(
        screen.getByRole('button', { name: 'Dismiss download of 4 documents' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Dismiss download of 7 documents' }),
      ).toBeInTheDocument();
    });

    it('dismisses only the job asked for, and keeps polling the other', async () => {
      await twoJobs();

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss download of 4 documents' }));

      expect(screen.queryByText('Zipping 4 documents…')).not.toBeInTheDocument();
      expect(screen.getByText('Zipping 7 documents…')).toBeInTheDocument();

      const dismissed = pollsFor('job-a');
      const kept = pollsFor('job-b');
      await tick(4000);

      expect(pollsFor('job-a')).toBe(dismissed);
      expect(pollsFor('job-b')).toBeGreaterThan(kept);
    });

    /** Dismissing leaves the panel open, so focus has to stay in it. */
    it('moves focus to the next job when one is dismissed', async () => {
      await twoJobs();
      const dismiss = screen.getByRole('button', { name: 'Dismiss download of 4 documents' });
      dismiss.focus();

      fireEvent.click(dismiss);

      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Dismiss download of 7 documents' }),
      );
    });

    it('falls back to the panel close button when the last job is dismissed', async () => {
      await twoJobs();
      const dismiss = screen.getByRole('button', { name: 'Dismiss download of 7 documents' });
      dismiss.focus();

      fireEvent.click(dismiss);

      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Close download panel' }),
      );
    });

    it('closes every job at once on the panel close', async () => {
      const panel = await twoJobs();
      const { container } = panel.render();

      fireEvent.click(screen.getAllByRole('button', { name: 'Close download panel' })[0]);

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText('Zipping 4 documents…')).not.toBeInTheDocument();
      expect(screen.queryByText('Zipping 7 documents…')).not.toBeInTheDocument();

      const pollsSoFar = fetchMock.mock.calls.length;
      await tick(60_000);

      expect(fetchMock.mock.calls.length).toBe(pollsSoFar);
    });

    /** The toolbar's Download only stops once demi-api is holding as many jobs as it will take. */
    it('blocks the next download at the third job in flight, not the first', async () => {
      postResponse = () =>
        new Response(JSON.stringify({ id: `job-${Date.now()}`, status: 'queued' }), {
          status: 202,
        });
      statusResponses = [{ status: 'queued', partCount: 0, partsReady: 0 }];
      const panel = await mount();
      panel.render();

      const inProgress = renderHook(() => panel.store.useDownloadInProgress());
      for (const count of [1, 2]) {
        panel.store.setSelected('documents', [ALPHA, BETA]);
        await startDownload(panel.store);
        expect(document.querySelectorAll('.download-panel__job')).toHaveLength(count);
        expect(inProgress.result.current).toBe(false);
      }

      panel.store.setSelected('documents', [ALPHA, BETA]);
      await startDownload(panel.store);

      expect(document.querySelectorAll('.download-panel__job')).toHaveLength(3);
      expect(inProgress.result.current).toBe(true);
    });
  });

  /**
   * A job still being zipped is stopped at the backend when the reader dismisses it, and when they
   * leave the site: nobody is left waiting for a zip.
   */
  describe('cancelling', () => {
    const RUNNING = (id: string) => ({ id, status: 'running', partCount: 1, partsReady: 0 });
    const READY = (id: string) => ({
      id,
      status: 'ready',
      partCount: 1,
      partsReady: 1,
      includedCount: 2,
      errorCount: 0,
      parts: [{ n: 1, fileName: `${id}.zip`, url: `https://nrs.example/${id}.zip` }],
    });

    it('cancels the job the reader dismissed, and leaves the other running', async () => {
      statusByJob = { 'job-a': RUNNING('job-a'), 'job-b': RUNNING('job-b') };
      const panel = await mount(
        { id: 'job-a', count: 4, startedAt: Date.now() },
        { id: 'job-b', count: 7, startedAt: Date.now() },
      );
      panel.render();
      await tick(0);

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss download of 4 documents' }));

      expect(cancelledIds()).toEqual(['job-a']);
      expect(screen.queryByText('Zipping 4 documents…')).not.toBeInTheDocument();
      expect(screen.getByText('Zipping 7 documents…')).toBeInTheDocument();
    });

    /** A zip already downloaded has nothing left to stop, and demi-api would answer 404 anyway. */
    it('sends no cancel for a job that already finished', async () => {
      statusByJob = { 'job-a': READY('job-a') };
      const panel = await mount({ id: 'job-a', count: 2, startedAt: Date.now() });
      panel.render();
      await tick(2000);

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss download of 2 documents' }));

      expect(cancelledIds()).toEqual([]);
    });

    it('cancels every job still in flight when the panel is closed', async () => {
      statusByJob = {
        'job-a': RUNNING('job-a'),
        'job-b': READY('job-b'),
        'job-c': RUNNING('job-c'),
      };
      const panel = await mount(
        { id: 'job-a', count: 4, startedAt: Date.now() },
        { id: 'job-b', count: 2, startedAt: Date.now() },
        { id: 'job-c', count: 9, startedAt: Date.now() },
      );
      const { container } = panel.render();
      await tick(2000);

      fireEvent.click(screen.getByRole('button', { name: 'Close download panel' }));

      expect(window.confirm).toHaveBeenCalledWith(
        'Closing this panel cancels the downloads still in progress. Cancel them?',
      );
      expect(cancelledIds().sort()).toEqual(['job-a', 'job-c']);
      expect(container).toBeEmptyDOMElement();
    });

    it('cancels nothing and keeps the panel open when closing is declined', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      statusByJob = { 'job-a': RUNNING('job-a') };
      const panel = await mount({ id: 'job-a', count: 4, startedAt: Date.now() });
      const { container } = panel.render();
      await tick(0);

      fireEvent.click(screen.getByRole('button', { name: 'Close download panel' }));

      expect(cancelledIds()).toEqual([]);
      expect(container).not.toBeEmptyDOMElement();
      expect(screen.getByText('Zipping 4 documents…')).toBeInTheDocument();
    });

    it('closes without asking once every job is terminal', async () => {
      statusByJob = { 'job-a': READY('job-a') };
      const panel = await mount({ id: 'job-a', count: 2, startedAt: Date.now() });
      const { container } = panel.render();
      await tick(2000);

      fireEvent.click(screen.getByRole('button', { name: 'Close download panel' }));

      expect(window.confirm).not.toHaveBeenCalled();
      expect(cancelledIds()).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    });

    /**
     * jsdom's `returnValue` is the legacy alias of the cancelled flag, so the prompt shows as a
     * prevented default: the browser only asks when the listener does that.
     */
    it('asks the browser to warn before leaving only while a job is in flight', async () => {
      statusByJob = { 'job-a': RUNNING('job-a') };
      const panel = await mount({ id: 'job-a', count: 4, startedAt: Date.now() });
      panel.render();
      await tick(0);

      expect(leave('beforeunload').defaultPrevented).toBe(true);

      statusByJob = { 'job-a': READY('job-a') };
      await tick(4000);
      await tick(1);

      expect(leave('beforeunload').defaultPrevented).toBe(false);
    });

    it('cancels what is in flight on the way out, with a request that outlives the page', async () => {
      statusByJob = { 'job-a': RUNNING('job-a'), 'job-b': READY('job-b') };
      const panel = await mount(
        { id: 'job-a', count: 4, startedAt: Date.now() },
        { id: 'job-b', count: 2, startedAt: Date.now() },
      );
      panel.render();
      await tick(2000);

      leave('pagehide');

      expect(cancelledIds()).toEqual(['job-a']);
      const sent = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit)?.method === 'DELETE',
      );
      expect(sent.every(([, init]) => (init as RequestInit).keepalive)).toBe(true);
    });

    it('says a cancelled job was cancelled, and lets the next download start', async () => {
      statusByJob = {
        'job-a': { id: 'job-a', status: 'cancelled', partCount: 1, partsReady: 0 },
        'job-b': RUNNING('job-b'),
        'job-c': RUNNING('job-c'),
      };
      const panel = await mount(
        { id: 'job-a', count: 4, startedAt: Date.now() },
        { id: 'job-b', count: 7, startedAt: Date.now() },
        { id: 'job-c', count: 9, startedAt: Date.now() },
      );
      panel.render();
      await tick(0);

      expect(screen.getByText('Download cancelled.')).toBeInTheDocument();
      // Three jobs is demi-api's limit; the cancelled one no longer counts against it.
      expect(renderHook(() => panel.store.useDownloadInProgress()).result.current).toBe(false);
    });
  });
});
