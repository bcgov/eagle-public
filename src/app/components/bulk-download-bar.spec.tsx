import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BulkDownloadJob } from 'app/state/bulk-download';

const JOB_KEY = 'epic-bulk-download-job';
const ALPHA = { id: 'doc-a', displayName: 'Alpha' };
const BETA = { id: 'doc-b', displayName: 'Beta' };

let postResponse: () => Response;
let statusResponses: unknown[];
let clickedHrefs: string[];

/**
 * The bar is the only place the browser learns a zip is ready, so its states are driven end to end
 * here: the POST, the poll, and the anchor navigations that actually fetch the parts.
 */
describe('BulkDownloadBar', () => {
  const originalEnv = window.__env;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    clickedHrefs = [];
    statusResponses = [];
    postResponse = () => new Response('{}', { status: 500 });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedHrefs.push(this.getAttribute('href') ?? '');
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return postResponse();
        const body = statusResponses.length > 1 ? statusResponses.shift() : statusResponses[0];
        return new Response(JSON.stringify(body), { status: 200 });
      })
    );
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Fresh module state per test: the selection and the persisted job are module-level stores, and
   * the job is rehydrated at import time.
   */
  async function mount(storedJob?: BulkDownloadJob) {
    if (storedJob) localStorage.setItem(JOB_KEY, JSON.stringify(storedJob));
    vi.resetModules();
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '/demi-search' };
    const config = await import('app/config/config');
    await config.loadConfig();
    const store = await import('app/state/bulk-download');
    const { BulkDownloadBar } = await import('./bulk-download-bar');

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return {
      store,
      render: () =>
        render(
          <QueryClientProvider client={client}>
            <BulkDownloadBar />
          </QueryClientProvider>
        )
    };
  }

  async function tick(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('stays out of the way with nothing selected and no job', async () => {
    const bar = await mount();

    const { container } = bar.render();

    expect(container).toBeEmptyDOMElement();
  });

  it('downloads every part of a finished job, one navigation each', async () => {
    postResponse = () =>
      new Response(JSON.stringify({ id: 'job-1', status: 'queued', documentCount: 2 }), { status: 202 });
    statusResponses = [
      { id: 'job-1', status: 'running', partCount: 2, partsReady: 1 },
      {
        id: 'job-1',
        status: 'ready',
        partCount: 2,
        partsReady: 2,
        errorCount: 0,
        parts: [
          { n: 1, url: 'https://nrs.example/part1.zip' },
          { n: 2, url: 'https://nrs.example/part2.zip' }
        ]
      }
    ];
    const bar = await mount();
    bar.store.setSelected('documents', [ALPHA, BETA]);
    bar.render();

    expect(screen.getByText('2 documents selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await tick(0);

    expect(screen.getByText('Preparing download… 1 of 2 parts')).toBeInTheDocument();

    // One poll interval later the job is ready and the first part goes.
    await tick(4000);
    // Two more turns of the clock: one for React to commit the ready status, one for the first
    // part's navigation, which the component schedules from that render.
    await tick(1);
    await tick(1);

    expect(clickedHrefs).toEqual(['https://nrs.example/part1.zip']);

    // The next follows a second later, so the browser asks once to allow multiple downloads.
    await tick(1000);

    expect(clickedHrefs).toEqual(['https://nrs.example/part1.zip', 'https://nrs.example/part2.zip']);
    expect(screen.getByText('Download started')).toBeInTheDocument();
  });

  it('names the files the zip could not include', async () => {
    postResponse = () => new Response(JSON.stringify({ id: 'job-1', status: 'queued' }), { status: 202 });
    statusResponses = [
      {
        id: 'job-1',
        status: 'ready',
        partCount: 1,
        partsReady: 1,
        errorCount: 3,
        parts: [{ n: 1, url: 'https://nrs.example/part1.zip' }]
      }
    ];
    const bar = await mount();
    bar.store.setSelected('documents', [ALPHA, BETA]);
    bar.render();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await tick(0);

    expect(
      screen.getByText('Download started (3 files could not be included; see errors.txt)')
    ).toBeInTheDocument();
  });

  it('explains a 429 rather than looking like a failure', async () => {
    postResponse = () => new Response('{}', { status: 429, statusText: 'Too Many Requests' });
    const bar = await mount();
    bar.store.setSelected('documents', [ALPHA, BETA]);
    bar.render();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await tick(0);

    expect(screen.getByText("You've reached the download limit. Try again later.")).toBeInTheDocument();
    expect(clickedHrefs).toEqual([]);
  });

  it('says so when bulk download is switched off at the backend', async () => {
    postResponse = () => new Response('{}', { status: 503, statusText: 'Service Unavailable' });
    const bar = await mount();
    bar.store.setSelected('documents', [ALPHA, BETA]);
    bar.render();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await tick(0);

    expect(screen.getByText('Bulk download is not available right now.')).toBeInTheDocument();
  });

  it('takes the presigned URL straight away for a single document, with no job', async () => {
    postResponse = () =>
      new Response(JSON.stringify({ url: 'https://nrs.example/one.pdf', single: true }), { status: 200 });
    const bar = await mount();
    bar.store.setSelected('documents', [ALPHA]);
    const { container } = bar.render();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await tick(0);

    expect(clickedHrefs).toEqual(['https://nrs.example/one.pdf']);
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('resumes a job left running by the previous page load', async () => {
    statusResponses = [{ id: 'job-9', status: 'running', partCount: 3, partsReady: 2 }];
    const bar = await mount({ id: 'job-9', tableId: 'documents', count: 40, startedAt: Date.now() - 60_000 });

    bar.render();
    await tick(0);

    expect(screen.getByText('Preparing download… 2 of 3 parts')).toBeInTheDocument();
  });

  it('drops a job left over from more than an hour ago', async () => {
    const bar = await mount({ id: 'job-9', tableId: 'documents', count: 40, startedAt: Date.now() - 3_700_000 });

    const { container } = bar.render();
    await tick(0);

    expect(container).toBeEmptyDOMElement();
  });

  it('clears the job and the selection on dismiss', async () => {
    statusResponses = [{ id: 'job-9', status: 'failed', partCount: 0, partsReady: 0 }];
    const bar = await mount({ id: 'job-9', tableId: 'documents', count: 40, startedAt: Date.now() });
    bar.store.setSelected('documents', [ALPHA, BETA]);
    const { container } = bar.render();
    await tick(0);

    expect(screen.getByText('That download could not be completed. Please try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
  });
});
