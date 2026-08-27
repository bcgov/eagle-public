import { describe, it, expect, afterEach } from 'vitest';
import { contentSearchEnabled, loadConfig } from './config';

/**
 * CONTENT_SEARCH decides whether the Document Content tab and route are offered at all, so a
 * truthy-but-not-true value must not turn it on: `/api/config` is hand-edited in Mongo and the
 * string "false" is truthy.
 */
describe('contentSearchEnabled', () => {
  const original = window.__env;

  afterEach(async () => {
    window.__env = original;
  });

  async function configuredWith(env: Record<string, unknown>): Promise<void> {
    window.__env = { logLevel: 4, ...env };
    await loadConfig();
  }

  it('is off when the flag is absent', async () => {
    await configuredWith({});
    expect(contentSearchEnabled()).toBe(false);
  });

  it('is on when the flag is true', async () => {
    await configuredWith({ CONTENT_SEARCH: true });
    expect(contentSearchEnabled()).toBe(true);
  });

  it('is off when the flag is false', async () => {
    await configuredWith({ CONTENT_SEARCH: false });
    expect(contentSearchEnabled()).toBe(false);
  });

  it('is off for a value that is merely truthy', async () => {
    await configuredWith({ CONTENT_SEARCH: 'false' });
    expect(contentSearchEnabled()).toBe(false);
  });
});
