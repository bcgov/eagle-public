import { useStore } from './store';
import { createStore } from './store';

export interface LoadingOperation {
  id: string;
  description?: string;
  startTime: number;
}

/**
 * Global loading state. Data functions start/stop operations by ID, and UIs read the overall
 * loading state or a specific operation's state.
 */
const operations = createStore<Map<string, LoadingOperation>>(new Map());

export function startLoading(id: string, description?: string): void {
  const current = new Map(operations.get());
  current.set(id, { id, description, startTime: Date.now() });
  operations.set(current);
}

export function stopLoading(id: string): void {
  const current = new Map(operations.get());
  current.delete(id);
  operations.set(current);
}

export function isOperationLoading(id: string): boolean {
  return operations.get().has(id);
}

export function stopAll(): void {
  operations.set(new Map());
}

export function getActiveOperationIds(): string[] {
  return Array.from(operations.get().keys());
}

export function useIsLoading(): boolean {
  return useStore(operations).size > 0;
}

export function useOperationLoading(id: string): boolean {
  return useStore(operations).has(id);
}

export function useActiveOperations(): LoadingOperation[] {
  return Array.from(useStore(operations).values());
}
