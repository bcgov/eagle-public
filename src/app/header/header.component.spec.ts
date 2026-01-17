import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';
import { ApiService } from 'app/services/api';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let mockApiService: { env: string; bannerColour: string };

  beforeEach(() => {
    mockApiService = {
      env: 'test',
      bannerColour: 'blue'
    };

    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService }
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
    mockApiService.bannerColour = 'no-banner-colour-set';
    fixture.detectChanges();
    expect(component.showBanner()).toBe(false);
  });

  it('should not show banner when env is empty', () => {
    mockApiService.env = '';
    fixture.detectChanges();
    expect(component.showBanner()).toBe(false);
  });

  it('should have a closeMenus method', () => {
    expect(component.closeMenus).toBeDefined();
  });
});
