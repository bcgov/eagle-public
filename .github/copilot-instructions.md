
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Logging

- NEVER use `console.log`, `console.error`, `console.warn`, `console.info`, or `console.debug` directly
- ALWAYS use the `LoggingService` for all logging operations
- Import and inject `LoggingService` from `app/services/logging.service`
- Available methods:
  - `logger.error(message, source?, data?)` - For errors (shown in all environments)
  - `logger.warn(message, source?, data?)` - For warnings (shown in dev/test)
  - `logger.info(message, source?, data?)` - For informational messages (shown in dev/test)
  - `logger.debug(message, source?, data?)` - For debug messages (shown in dev/local only)
  - `logger.trace(message, source?, data?)` - For very verbose tracing (shown in dev/local only)
- Always provide a source string (component/service name) for better log traceability
- Production environment (`env=prod`) only shows ERROR level logs
- Example usage:
  ```typescript
  private logger = inject(LoggingService);
  
  this.logger.error('Failed to load projects', 'ProjectsComponent', error);
  this.logger.info('Loaded 336 projects', 'StorageService');
  this.logger.debug('Cache hit for URL', 'HttpCache');
  ```

## Development Environment

- This project runs in a Debian LXC container accessed via VS Code Remote Explorer from Windows
- The dev server runs at `http://localhost:4200`
- Use VS Code's Simple Browser for testing instead of MCP Chrome DevTools
- MCP Chrome DevTools requires additional port forwarding configuration in this remote setup
