import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EnvConfig } from 'app/config/config';

/**
 * Penguin and eagle-analytics run side by side during the changeover, so every page and track call
 * has to reach both, and each backend has to switch on and off without touching the other.
 */
const mocks = vi.hoisted(() => ({
  createAnalytics: vi.fn(),
  eagle: { page: vi.fn(), track: vi.fn(), reset: vi.fn() },
  penguin: { page: vi.fn(), track: vi.fn(), reset: vi.fn() },
}));

vi.mock('@digitalspace/eagle-analytics-client', () => ({
  createAnalytics: mocks.createAnalytics,
}));

// The penguin path is stubbed at the `analytics` package: its plugin opens real listeners, timers
// and POSTs on startTracking, none of which this module owns.
vi.mock('analytics', () => ({ default: vi.fn(() => mocks.penguin) }));

const BOTH: EnvConfig = {
  ANALYTICS_API_URL: '/analytics',
  EAGLE_ANALYTICS_URL: '/eagle-analytics',
  ANALYTICS_DEBUG: false,
  ANALYTICS_ENHANCED_TRACKING: true,
  ANALYTICS_TRAFFIC_TRACKING: true,
};

/** Fresh module graph per test — analytics.ts keeps its instances and its init flag at module level. */
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

describe('the analytics fan-out', () => {
  it('sends track to both backends', async () => {
    const { track } = await loadWith(BOTH);

    track('Document Downloaded', { doc: 'abc' });

    expect(mocks.eagle.track).toHaveBeenCalledWith('Document Downloaded', { doc: 'abc' });
    expect(mocks.penguin.track).toHaveBeenCalledWith('Document Downloaded', { doc: 'abc' });
  });

  it('sends page to both backends', async () => {
    const { page } = await loadWith(BOTH);

    page('Projects', { path: '/projects' });

    expect(mocks.eagle.page).toHaveBeenCalledWith('Projects', { path: '/projects' });
    expect(mocks.penguin.page).toHaveBeenCalledWith({ name: 'Projects', path: '/projects' });
  });

  it('sends reset to both backends', async () => {
    const { reset } = await loadWith(BOTH);

    reset();

    expect(mocks.eagle.reset).toHaveBeenCalled();
    expect(mocks.penguin.reset).toHaveBeenCalled();
  });

  it('passes the configured URL and flags to the client', async () => {
    await loadWith(BOTH);

    expect(createdConfig()).toMatchObject({
      apiUrl: '/eagle-analytics',
      sourceApp: 'eagle-public',
      debug: false,
      enhancedTracking: true,
      trafficTracking: true,
    });
  });

  it('builds the client with an empty URL when EAGLE_ANALYTICS_URL is unset', async () => {
    const { track } = await loadWith({ ...BOTH, EAGLE_ANALYTICS_URL: '' });

    // Empty apiUrl is the client's own no-op switch, so calls still go through it and send nothing.
    expect(createdConfig().apiUrl).toBe('');
    track('Document Downloaded');
    expect(mocks.eagle.track).toHaveBeenCalledWith('Document Downloaded', undefined);
    expect(mocks.penguin.track).toHaveBeenCalled();
  });

  it('keeps the client running when the penguin URL is empty', async () => {
    const { track } = await loadWith({ ...BOTH, ANALYTICS_API_URL: '' });

    track('Document Downloaded');

    expect(mocks.eagle.track).toHaveBeenCalledWith('Document Downloaded', undefined);
    expect(mocks.penguin.track).not.toHaveBeenCalled();
  });
});
