import { describe, it, expect, afterEach, vi } from 'vitest';
import { Component, ErrorHandler, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { GlobalErrorHandler, logBootstrapFailure } from './global-error-handler';
import { LoggingService } from './logging.service';

@Component({ selector: 'app-boot-probe', template: '' })
class BootProbe {}

/** A failed boot, such as a config that never loads, must reach the log once, not once per catcher. */
describe('logBootstrapFailure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('logs a failed app initializer once', async () => {
    const error = vi.spyOn(LoggingService.prototype, 'error').mockImplementation(() => undefined);
    document.body.innerHTML = '<app-boot-probe></app-boot-probe>';
    const failure = new Error('config unavailable');

    await bootstrapApplication(BootProbe, {
      providers: [
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        provideAppInitializer(() => Promise.reject(failure)),
      ],
    }).catch(logBootstrapFailure);

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain('config unavailable');
  });

  it('logs a failure the error handler never saw', () => {
    const error = vi.spyOn(LoggingService.prototype, 'error').mockImplementation(() => undefined);
    const failure = new Error('no injector');
    logBootstrapFailure(failure);
    expect(error).toHaveBeenCalledWith('bootstrap failed', 'main', failure);
  });
});
