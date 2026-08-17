import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { ApiService } from 'app/services/api';
import { ConfigService } from 'app/services/config.service';
import { previewGateSatisfied } from 'app/preview-gate/preview-gate.component';
import { of } from 'rxjs';

// jsdom implements <dialog> but not showModal(), and these tests are the first to actually mount
// the gate — without this the gate's afterNextRender logs a TypeError on every gated render.
HTMLDialogElement.prototype.showModal = () => undefined;

describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let mockApiService: { apiPath: string; env: string; bannerColour: string; adminUrl: string };

  beforeEach(() => {
    mockApiService = {
      apiPath: 'https://great-api.gov.bc.ca/api/public',
      env: 'test',
      bannerColour: 'no-banner-colour-set',
      adminUrl: 'http://localhost:4000/admin/'
    };

    const mockConfigService = {
      init: () => Promise.resolve(),
      lists: of([]),
      config: signal({
        ENVIRONMENT: 'test',
        BANNER_COLOUR: 'red',
        API_PATH: 'https://great-api.gov.bc.ca/api/public',
        ADMIN_PATH: 'http://localhost:4000/admin/',
        ANALYTICS_API_URL: 'http://localhost:3001',
        ANALYTICS_DEBUG: true
      })
    };

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: ConfigService, useValue: mockConfigService }
      ]
    });

    // Module-level signal, so it leaks between tests unless it is reset. The gate is off
    // everywhere but the Azure preview, which is the default the other tests assume.
    previewGateSatisfied.set(true);

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have title', () => {
    expect(component.title).toBe('EPIC - Environmental Assessment Office');
  });

  it('should render the header in a span tag', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const titleElement = compiled.querySelector('span.navbar-brand__title');
    expect(titleElement?.textContent).toContain('EPIC');
  });

  // The whole point of the preview gate: unsatisfied means the app is ABSENT, not covered. A
  // dialog layered over a rendered app still shipped the unreleased UI through the ::backdrop and
  // still let every route component fire its API calls.
  it('should render no app content while the preview gate is unsatisfied', () => {
    previewGateSatisfied.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-wrapper')).toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeNull();
    expect(compiled.querySelector('app-header')).toBeNull();
    expect(compiled.querySelector('app-footer')).toBeNull();
    expect(compiled.querySelector('app-toast-container')).toBeNull();
    expect(compiled.querySelector('span.navbar-brand__title')).toBeNull();
  });

  it('should render app content once the preview gate is satisfied', () => {
    previewGateSatisfied.set(false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.app-wrapper')).toBeNull();

    previewGateSatisfied.set(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.app-wrapper')).not.toBeNull();
  });
});
