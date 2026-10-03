import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { HeaderComponent } from './header.component';
import { ConfigService } from 'app/services/config.service';

interface MockConfig {
  ENVIRONMENT: string;
  BANNER_COLOUR: string;
}

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let configSignal: WritableSignal<MockConfig>;

  beforeEach(() => {
    configSignal = signal<MockConfig>({
      ENVIRONMENT: 'test',
      BANNER_COLOUR: 'blue'
    });

    const mockConfigService = {
      config: configSignal,
      lists: { subscribe: () => ({ unsubscribe: () => undefined }) }
    };

    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: ConfigService, useValue: mockConfigService }
      ]
    });

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with environment name', () => {
    fixture.detectChanges();
    expect(component.envName()).toBe('test');
  });

  it('should initialize with banner colour', () => {
    fixture.detectChanges();
    expect(component.bannerColour()).toBe('blue');
  });

  it('should show banner when env and bannerColour are set', () => {
    fixture.detectChanges();
    expect(component.showBanner()).toBe(true);
  });

  it('should not show banner when bannerColour is default', () => {
    configSignal.set({ ENVIRONMENT: 'test', BANNER_COLOUR: 'no-banner-colour-set' });
    fixture.detectChanges();
    expect(component.showBanner()).toBe(false);
  });

  it('should show banner when env is empty (defaults to local)', () => {
    // When ENVIRONMENT is empty, envName() defaults to 'local', which shows banner
    configSignal.set({ ENVIRONMENT: '', BANNER_COLOUR: 'blue' });
    fixture.detectChanges();
    expect(component.envName()).toBe('local');
    expect(component.showBanner()).toBe(true);
  });

  it('should have a closeMenus method', () => {
    expect(component.closeMenus).toBeDefined();
  });
});
