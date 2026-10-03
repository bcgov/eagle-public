import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api';
import { DocumentService } from './document.service';
import { SearchService } from './search.service';

describe('DocumentService', () => {
  let service: DocumentService;
  let mockApiService: any;

  beforeEach(() => {
    mockApiService = {
      getDocumentsByAppId: vi.fn(),
      handleError: vi.fn()
    };

    const mockSearchService = {
      getSearchResults: vi.fn(),
      getItem: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: SearchService, useValue: mockSearchService },
        DocumentService
      ]
    });

    service = TestBed.inject(DocumentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
