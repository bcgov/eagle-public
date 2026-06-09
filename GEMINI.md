# Eagle Public Instructions

Public-facing Angular app for EPIC.

## Development Setup

- **Branch**: `develop` (NOT main)
- **Package Manager**: Yarn 4.12.0
- **Node Version**: 24.x
- **Framework**: Angular 21.0.0
- **Port**: 4200 (dev)

## CRITICAL Angular 21 Mandates

- **Standalone Components**: Do NOT set `standalone: true`. It is the default; omit it.
- **Signals**: Use `input()`/`output()` functions (NOT decorators). Use `computed()` for derived state.
- **Dependency Injection**: Use `inject()` (NOT constructor injection).
- **Change Detection**: MUST use `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- **Control Flow**: Use native control flow (`@if`, `@for`, `@switch`). NEVER use `*ngIf`, `*ngFor`.
- **Bindings**: Use `host` object in decorator (NOT `@HostBinding`). Use `class`/`style` bindings (NOT `ngClass`).

## Component Design Patterns

- **API Initialization**: Call API services in the component `constructor`.
- **Loading State**: Use `signal<T | null>(null)` as initial value to distinguish between "loading" and "empty".
- **RxJS**: Use `withLoading` operator in services. Use `switchMap` for cancellable HTTP requests.
- **Debouncing**: Use `debounceTime(0)` to collapse synchronous signal/effect bursts.
- **Cleanup**: Use `takeUntilDestroyed()` or a `destroy$` subject.

## Configuration & Analytics

- **Runtime Config**: Two-phase load. App fetches config from `/api/config`. Local dev uses `env.js`.
- **Analytics**: Tracked via `AnalyticsService`. `ANALYTICS_ENHANCED_TRACKING` flag controls fingerprinting.

## Testing & Deployment

- **Test Framework**: Vitest (NOT Karma).
- **Deployment**: Helm charts in `helm/eagle-public/`. Namespaces: `6cdc9e-dev`, `6cdc9e-test`, `6cdc9e-prod`.
