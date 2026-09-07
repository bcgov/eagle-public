import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EnvConfig } from 'app/config/config';

/**
 * One backend now: penguin-analytics is decommissioned (rproxy answers `/analytics` with 410), so
 * every page, track and reset call has to reach the eagle-analytics client and nothing else, and
 * the retired ANALYTICS_API_URL key must not be able to point it anywhere.
 */
const mocks = vi.hoisted(() => ({
  createAnalytics: vi.fn(),
  eagle: { page: vi.fn(), track: vi.fn(), reset: vi.fn() },
}));

vi.mock('@digitalspace/eagle-analytics-client', () => ({
  createAnalytics: mocks.createAnalytics,
}));

const CONFIG: EnvConfig = {
  EAGLE_ANALYTICS_URL: '/api/usage',
  ANALYTICS_DEBUG: false,
  ANALYTICS_ENHANCED_TRACKING: true,
  ANALYTICS_TRAFFIC_TRACKING: true,
};

/** Fresh module graph per test — analytics.ts keeps its instance and its init flag at module level. */
async function loadWith(config: EnvConfig) {
  vi.resetModules();
  const module = await import('./analytics');
  module.initAnalytics(config);
  return module;
}

function createdConfig() {
  return mocks.createAnalytics.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAnalytics.mockReturnValue(mocks.eagle);
});

describe('analytics', () => {
  it('sends track to the client', async () => {
    const { track } = await loadWith(CONFIG);

    track('Document Downloaded', { doc: 'abc' });

    expect(mocks.eagle.track).toHaveBeenCalledWith('Document Downloaded', { doc: 'abc' });
  });

  it('sends page to the client', async () => {
    const { page } = await loadWith(CONFIG);

    page('Projects', { path: '/projects' });

    expect(mocks.eagle.page).toHaveBeenCalledWith('Projects', { path: '/projects' });
  });

  it('sends reset to the client', async () => {
    const { reset } = await loadWith(CONFIG);

    reset();

    expect(mocks.eagle.reset).toHaveBeenCalled();
  });

  it('passes the configured URL and flags to the client', async () => {
    await loadWith(CONFIG);

    expect(mocks.createAnalytics).toHaveBeenCalledTimes(1);
    expect(createdConfig()).toMatchObject({
      apiUrl: '/api/usage',
      sourceApp: 'eagle-public',
      debug: false,
      enhancedTracking: true,
      trafficTracking: true,
    });
  });

  it('builds the client with an empty URL when EAGLE_ANALYTICS_URL is unset', async () => {
    const { track } = await loadWith({ ...CONFIG, EAGLE_ANALYTICS_URL: '' });

    // Empty apiUrl is the client's own no-op switch, so calls still go through it and send nothing.
    expect(createdConfig().apiUrl).toBe('');
    track('Document Downloaded');
    expect(mocks.eagle.track).toHaveBeenCalledWith('Document Downloaded', undefined);
  });

  it('ignores the retired penguin ANALYTICS_API_URL key', async () => {
    // eagle-api still serves this key; nothing here may fall back to it or penguin comes back on.
    await loadWith({
      ...CONFIG,
      EAGLE_ANALYTICS_URL: '',
      ANALYTICS_API_URL: '/analytics',
    } as EnvConfig);

    expect(createdConfig().apiUrl).toBe('');
  });

  it('defaults flags off and debug on outside production', async () => {
    await loadWith({ ENVIRONMENT: 'test' });

    expect(createdConfig()).toMatchObject({
      debug: true,
      enhancedTracking: false,
      trafficTracking: false,
    });
  });

  it('defaults debug off in production', async () => {
    await loadWith({ ENVIRONMENT: 'prod' });

    expect(createdConfig().debug).toBe(false);
  });

  it('builds one client however often it is initialized', async () => {
    const { initAnalytics } = await loadWith(CONFIG);

    initAnalytics({ ...CONFIG, EAGLE_ANALYTICS_URL: '/somewhere-else' });

    expect(mocks.createAnalytics).toHaveBeenCalledTimes(1);
    expect(createdConfig().apiUrl).toBe('/api/usage');
  });

  it('does not throw when a call arrives before init', async () => {
    vi.resetModules();
    const { track, page, reset } = await import('./analytics');

    expect(() => {
      track('Document Downloaded');
      page('Projects');
      reset();
    }).not.toThrow();
    expect(mocks.eagle.track).not.toHaveBeenCalled();
  });
});
