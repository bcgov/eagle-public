import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';

// The route table pulls in the map component, which reads the Leaflet global that index.html
// loads from a script tag. jsdom has no such tag, and the two icons are built at module load.
vi.hoisted(() => { (globalThis as any).L = { icon: () => ({}) }; });

import { contentSearchGuard, routes } from './app.routes';
import { ConfigService } from './services/config.service';

describe('contentSearchGuard', () => {
  function runGuard(contentSearchEnabled: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ConfigService, useValue: { contentSearchEnabled: () => contentSearchEnabled } }
      ]
    });
    return TestBed.runInInjectionContext(() => contentSearchGuard(routes[0], []));
  }

  it('sends /search/content to /search when content search is disabled', () => {
    const result = runGuard(false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/search');
  });

  it('allows /search/content when content search is enabled', () => {
    expect(runGuard(true)).toBe(true);
  });

  it('guards the content search route', () => {
    const route = routes.find(r => r.path === 'search/content');
    expect(route).toBeDefined();
    expect(route!.canMatch ?? []).toContain(contentSearchGuard);
  });
});
