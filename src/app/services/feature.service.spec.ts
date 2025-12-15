import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FeatureService } from './feature.service';
import { ApiService } from './api';

describe('FeatureService', () => {
  let service: FeatureService;
  let mockApiService: any;

  beforeEach(() => {
    mockApiService = {
      getFeaturesByTantalisId: vi.fn(),
      getFeaturesByApplicationId: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        FeatureService,
        { provide: ApiService, useValue: mockApiService }
      ]
    });

    service = TestBed.inject(FeatureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
