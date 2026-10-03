import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { getJson } from './api';
import { loadConfig } from 'app/config/config';
import { logger } from 'app/config/logging';
import { trackException } from 'app/config/telemetry';

vi.mock('app/config/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/config/telemetry')>()),
  trackException: vi.fn(),
}));

/**
 * Search-as-you-type aborts a request per keystroke. Reporting those as errors would fill
 * Application Insights with exceptions for requests the app dropped on purpose.
 */
describe('aborted requests are not reported', () => {
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;
  let logHttpError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    window.__env = { logLevel: 4, SEARCH_API_PATH: '/demi-search' };
    await loadConfig();
    logHttpError = vi.spyOn(logger, 'logHttpError').mockImplementation(() => undefined);
    vi.mocked(trackException).mockClear();
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs nothing and reports nothing when the caller aborts', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));

    await expect(
      getJson('/demi-search/search?keywords=car', { signal: controller.signal }),
    ).rejects.toThrow(/aborted/i);

    expect(logHttpError).not.toHaveBeenCalled();
    expect(trackException).not.toHaveBeenCalled();
  });

  it('still logs and reports a network failure that is not an abort', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getJson('/demi-search/search?keywords=caribou')).rejects.toThrow(
      /Failed to fetch/,
    );

    expect(logHttpError).toHaveBeenCalledTimes(1);
  });

  it('reports a network failure to Application Insights', async () => {
    logHttpError.mockRestore();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getJson('/demi-search/search?keywords=caribou')).rejects.toThrow(
      /Failed to fetch/,
    );

    expect(trackException).toHaveBeenCalledTimes(1);
  });
});
