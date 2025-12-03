/* SystemJS module definition */
declare var module: NodeModule;
interface NodeModule {
  id: string;
}

// Polyfill for TypeScript < 3.5 Omit utility type
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
