import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvConfig, ConfigService } from './config.service';
import { GateService } from './gate.service';

/**
 * The curtain must never open on its own: prod sends ACCESS_GATE false, and a wrong password must
 * leave the app hidden. Only a 204 from eagle-api counts as unlocked.
 */
describe('GateService', () => {
  const URL = '/api/public/gate';
  let httpMock: HttpTestingController;

  function setup(config: EnvConfig): GateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GateService,
        {
          provide: ConfigService,
          useValue: { getApiPath: () => '/api', config: signal(config) }
        }
      ]
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(GateService);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => httpMock.verify());

  it('is open when the flag is absent', () => {
    expect(setup({}).open()).toBe(true);
  });

  it('is open for a value that is merely truthy', () => {
    expect(setup({ ACCESS_GATE: 'true' as unknown as boolean }).open()).toBe(true);
  });

  it('is closed when the flag is true', () => {
    expect(setup({ ACCESS_GATE: true }).open()).toBe(false);
  });

  it('opens and remembers the session on 204', async () => {
    const gate = setup({ ACCESS_GATE: true });
    const unlocked = gate.unlock('hunter2');

    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ password: 'hunter2' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(await unlocked).toBe(true);
    expect(gate.open()).toBe(true);
    expect(sessionStorage.getItem('eagle-gate')).toBe('1');
  });

  it('stays closed on 401', async () => {
    const gate = setup({ ACCESS_GATE: true });
    const unlocked = gate.unlock('wrong');
    httpMock.expectOne(URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await unlocked).toBe(false);
    expect(gate.open()).toBe(false);
    expect(sessionStorage.getItem('eagle-gate')).toBe(null);
  });

  it('throws on anything else so the caller can say something went wrong', async () => {
    const gate = setup({ ACCESS_GATE: true });
    const unlocked = gate.unlock('anything');
    httpMock.expectOne(URL).flush(null, { status: 404, statusText: 'Not Found' });

    await expect(unlocked).rejects.toBeDefined();
    expect(gate.open()).toBe(false);
  });

  it('stays open for a session that already unlocked', () => {
    sessionStorage.setItem('eagle-gate', '1');
    expect(setup({ ACCESS_GATE: true }).open()).toBe(true);
  });
});
