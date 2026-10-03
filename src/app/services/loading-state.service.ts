import { Injectable, signal, computed } from '@angular/core';

export interface LoadingOperation {
  id: string;
  description?: string;
  startTime: number;
}

/**
 * Global loading state management service.
 * Services can start/stop loading operations by ID, and UIs can subscribe
 * to the overall loading state or specific operation states.
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingStateService {
  private operations = signal<Map<string, LoadingOperation>>(new Map());
  
  // Public computed signals
  public readonly isLoading = computed(() => this.operations().size > 0);
  public readonly activeOperations = computed(() => Array.from(this.operations().values()));
  public readonly operationCount = computed(() => this.operations().size);
  
  /**
   * Start a loading operation
   */
  startLoading(id: string, description?: string): void {
    const current = new Map(this.operations());
    current.set(id, {
      id,
      description,
      startTime: Date.now()
    });
    this.operations.set(current);
  }
  
  /**
   * Stop a loading operation
   */
  stopLoading(id: string): void {
    const current = new Map(this.operations());
    current.delete(id);
    this.operations.set(current);
  }
  
  /**
   * Check if a specific operation is loading
   */
  isOperationLoading(id: string): boolean {
    return this.operations().has(id);
  }
  
  /**
   * Get a computed signal for a specific operation
   */
  getOperationState(id: string) {
    return computed(() => this.operations().has(id));
  }
  
  /**
   * Stop all loading operations
   */
  stopAll(): void {
    this.operations.set(new Map());
  }
  
  /**
   * Get all active operation IDs
   */
  getActiveOperationIds(): string[] {
    return Array.from(this.operations().keys());
  }
}
