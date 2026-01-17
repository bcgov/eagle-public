import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ApiService } from 'app/services/api';
import { ConfigService } from 'app/services/config.service';
import { of } from 'rxjs';

describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let mockApiService: { apiPath: string; env: string; bannerColour: string; adminUrl: string };
  let mockConfigService: { init: () => void; lists: { subscribe: () => void } };

  beforeEach(() => {
    mockApiService = {
      apiPath: 'https://great-api.gov.bc.ca/api/public',
      env: 'test',
      bannerColour: 'no-banner-colour-set',
      adminUrl: 'http://localhost:4000/admin/'
    };

    mockConfigService = {
      init: () => { /* mock implementation */ },
      lists: of([])
    };

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: ConfigService, useValue: mockConfigService }
      ]
    });

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
});
