import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';
import { ApiService } from 'app/services/api';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;
  let mockApiService: { adminUrl: string };

  beforeEach(() => {
    mockApiService = {
      adminUrl: 'http://localhost:4000/admin/'
    };

    TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService }
      ]
    });

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have access to ApiService', () => {
    expect(component.api).toBeDefined();
    expect(component.api.adminUrl).toBe('http://localhost:4000/admin/');
  });

  it('should have access to Router', () => {
    expect(component.router).toBeDefined();
  });
});
