import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { ConfigService } from './config.service';

/**
 * CONTENT_SEARCH decides whether the Document Content tab and route are offered at all, so a
 * truthy-but-not-true value must not turn it on: `/api/config` is hand-edited in Mongo and the
 * string "false" is truthy.
 */
describe('ConfigService.contentSearchEnabled', () => {
  const original = (window as any).__env;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });

  afterEach(() => {
    (window as any).__env = original;
  });

  async function serviceWith(env: Record<string, unknown>): Promise<ConfigService> {
    (window as any).__env = { logLevel: 4, ...env };
    const service = TestBed.inject(ConfigService);
    await service.init();
    return service;
  }

  it('is off when the flag is absent', async () => {
    expect((await serviceWith({})).contentSearchEnabled()).toBe(false);
  });

  it('is on when the flag is true', async () => {
    expect((await serviceWith({ CONTENT_SEARCH: true })).contentSearchEnabled()).toBe(true);
  });

  it('is off when the flag is false', async () => {
    expect((await serviceWith({ CONTENT_SEARCH: false })).contentSearchEnabled()).toBe(false);
  });

  it('is off for a value that is merely truthy', async () => {
    expect((await serviceWith({ CONTENT_SEARCH: 'false' as any })).contentSearchEnabled()).toBe(false);
  });
});
