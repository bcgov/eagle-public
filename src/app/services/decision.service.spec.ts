import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Decision } from 'app/models/decision';
import { of, throwError } from 'rxjs';
import { ApiService } from './api';
import { DecisionService } from './decision.service';
import { DocumentService } from './document.service';
import { Document } from 'app/models/document';

describe('DecisionService', () => {
  let service: DecisionService;
  let mockApiService: any;
  let mockDocumentService: any;

  beforeEach(() => {
    mockApiService = {
      getDecisionByAppId: vi.fn(),
      getDecision: vi.fn(),
      handleError: vi.fn()
    };

    mockDocumentService = {
      getAllByDecisionId: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: DocumentService, useValue: mockDocumentService },
        DecisionService
      ]
    });

    service = TestBed.inject(DecisionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getByApplicationId', () => {
    it('returns null when no decision is returned by the API', () => {
      mockApiService.getDecisionByAppId.mockReturnValue(
        of({ text: () => {} })
      );

      service.getByApplicationId('1', true).subscribe(result => {
        expect(result).toBeNull();
      });
    });

    it('returns one Decision with documents when API returns data', () => {
      mockApiService.getDecisionByAppId.mockReturnValue(
        of({
          text: () => 'notNull',
          json: () => [{ _id: '1' }]
        })
      );

      mockDocumentService.getAllByDecisionId.mockImplementation((decisionId: string) => {
        expect(decisionId).toEqual('1');
        return of([new Document({ _id: '11' })]);
      });

      service.getByApplicationId('1', true).subscribe(result => {
        expect(result).toBeTruthy();
        expect(result?._id).toEqual('1');
      });
    });

    it('returns only the first Decision when multiple are returned', () => {
      mockApiService.getDecisionByAppId.mockReturnValue(
        of({
          text: () => 'notNull',
          json: () => [{ _id: '2' }, { _id: '3' }, { _id: '4' }]
        })
      );

      mockDocumentService.getAllByDecisionId.mockReturnValue(
        of([new Document({ _id: '22' })])
      );

      service.getByApplicationId('1', true).subscribe(result => {
        expect(result?._id).toEqual('2');
      });
    });

    it('handles errors gracefully', () => {
      const error = new Error('API Error');
      mockApiService.getDecisionByAppId.mockReturnValue(
        throwError(() => error)
      );
      mockApiService.handleError.mockReturnValue(
        throwError(() => new Error('Handled Error'))
      );

      service.getByApplicationId('1', true).subscribe({
        error: (err) => {
          expect(err.message).toContain('Error');
        }
      });
    });
  });

  describe('getById', () => {
    it('returns null when no decision is returned by the API', () => {
      mockApiService.getDecision.mockReturnValue(of({ text: () => {} }));

      service.getById('1', true).subscribe(result => {
        expect(result).toBeNull();
      });
    });

    it('returns one Decision with documents when API returns data', () => {
      mockApiService.getDecision.mockReturnValue(
        of({
          text: () => 'notNull',
          json: () => [{ _id: '1' }]
        })
      );

      mockDocumentService.getAllByDecisionId.mockImplementation((decisionId: string) => {
        expect(decisionId).toEqual('1');
        return of([new Document({ _id: '11' })]);
      });

      service.getById('1', true).subscribe(result => {
        expect(result).toBeTruthy();
        expect(result?._id).toEqual('1');
      });
    });

    it('handles errors gracefully', () => {
      const error = new Error('API Error');
      mockApiService.getDecision.mockReturnValue(
        throwError(() => error)
      );
      mockApiService.handleError.mockReturnValue(
        throwError(() => new Error('Handled Error'))
      );

      service.getById('1', true).subscribe({
        error: (err) => {
          expect(err.message).toContain('Error');
        }
      });
    });
  });
});
