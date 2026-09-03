import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from './logging';
import { trackException } from './telemetry';
import { loadConfig } from './config';

/**
 * Every logger.error already in the app is a bug report, so the ERROR path is what feeds
 * Application Insights. Nothing quieter than ERROR may reach it, and a raised log level must not
 * silence it either.
 */
vi.mock('./telemetry', () => ({ trackException: vi.fn() }));

const reported = vi.mocked(trackException);

beforeEach(async () => {
  reported.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  window.__env = { logLevel: 0 };
  await loadConfig();
});

afterEach(() => vi.restoreAllMocks());

describe('logger.error', () => {
  it('reports the message', () => {
    logger.error('search failed', 'SearchPage');
    expect(reported).toHaveBeenCalledWith(expect.stringContaining('search failed'), {
      source: 'SearchPage',
    });
  });

  it('reports the error object when there is one, so the real stack survives', () => {
    const error = new Error('502 Bad Gateway');
    logger.logHttpError('GET', '/api/project', error, 'ProjectApi');
    expect(reported).toHaveBeenCalledWith(error, { source: 'ProjectApi' });
  });

  it('still reports when the console is turned down', async () => {
    window.__env = { logLevel: 5 };
    await loadConfig();
    logger.error('search failed');
    expect(reported).toHaveBeenCalledTimes(1);
  });
});

describe('quieter levels', () => {
  it('report nothing', () => {
    logger.warn('slow response');
    logger.info('loaded');
    logger.debug('details');
    expect(reported).not.toHaveBeenCalled();
  });
});
