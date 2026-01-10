
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- MUST explicitly set `standalone: true` when using the `imports` array in component decorators
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.
- NEVER manually call `ChangeDetectorRef.detectChanges()` - rely on signals and immutable state updates instead

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
- When using external templates/styles, use paths relative to the component TS file
- Use `styleUrl:` (singular) instead of `styleUrls:` (plural) - use string for single file, array only when multiple stylesheets are necessary

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead
- Always use immutable patterns when updating signal state - create new objects/arrays instead of mutating existing ones
- Replace manual subscription management with signals where possible to avoid memory leaks

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available
- Do not write arrow functions in templates (they are not supported)
- Remember to call signal functions in templates: `@if (loading())` not `@if (loading)`

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
- Avoid deprecated Angular APIs like `ComponentFactoryResolver` - use modern alternatives like `ViewContainerRef.createComponent()` directly

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

## Loading State Management

- ALL loading state management MUST be handled by the `LoadingStateService`
- **Services that make API calls own loading state - components and other services only observe it**
- NEVER manage loading state in components (no local `loading` properties)
- CRITICAL: The service that makes the actual API call MUST manage the loading state
  - Example: `SearchService.fetchData()` makes API calls, so it manages `table-{tableId}` loading state
  - Example: `TableService.fetchData()` only orchestrates, so it does NOT manage loading state
  - This ensures loading state starts BEFORE any data access, preventing "flash of empty state"
- Pattern for services that make API calls:
  - Call `startLoading(operationId, description)` IMMEDIATELY before API calls
  - Call `stopLoading(operationId)` in both success and error paths
  - Use RxJS operators: `map()` or `tap()` for success, `catchError()` for errors
  - For async/await: Use try/catch with stopLoading in catch block AND after successful response
  - Always use unique operation IDs (e.g., 'home', 'document-{id}', 'table-{tableId}')
  - For table data: Use `table-{tableId}` pattern (e.g., 'table-projectList')
- Pattern for components:
  - Inject `LoadingStateService` as public: `public loadingState = inject(LoadingStateService)`
  - Subscribe to loading state: `loading = this.loadingState.getOperationState('operation-id')`
  - Use in templates: `@if (loading())` (remember to call the signal function)
  - For dynamic IDs, use computed: `computed(() => this.loadingState.getOperationState(\`op-${id}\`)())`
- NEVER call `startLoading` or `stopLoading` from components
- Example service implementation (RxJS):
  ```typescript
  getById(id: string): Observable<Project> {
    this.loadingState.startLoading(`project-${id}`, 'Loading project');
    return this.api.getProject(id).pipe(
      map(data => {
        this.loadingState.stopLoading(`project-${id}`);
        return data;
      }),
      catchError(error => {
        this.loadingState.stopLoading(`project-${id}`);
        throw error;
      })
    );
  }
  ```
- Example service implementation (async/await):
  ```typescript
  async fetchData(searchParamObject: SearchParamObject) {
    const loadingId = `table-${searchParamObject.tableId}`;
    this.loadingState.startLoading(loadingId, 'Loading data');
    try {
      const res = await this.api.search(searchParamObject).toPromise();
      // Process res...
      this.loadingState.stopLoading(loadingId);
      return result;
    } catch (error) {
      this.loadingState.stopLoading(loadingId);
      throw error;
    }
  }
  ```
- Example component usage:
  ```typescript
  export class ProjectComponent {
    public loadingState = inject(LoadingStateService);
    loading = this.loadingState.getOperationState('project-list');
  }
  ```

## Development Environment

- This project runs in a Debian LXC container accessed via VS Code Remote Explorer from Windows
- The dev server runs at `http://localhost:4200`
- Use VS Code's Simple Browser for testing instead of MCP Chrome DevTools
- MCP Chrome DevTools requires additional port forwarding configuration in this remote setup

## Responsive Design & Bootstrap 5.3

- Always use Bootstrap 5.3 standard breakpoints in custom CSS:
  - `576px` (sm - small devices)
  - `768px` (md - tablets)
  - `992px` (lg - desktops)
  - `1200px` (xl - large desktops)
  - `1400px` (xxl - extra large desktops)
- Prefer Bootstrap utility classes over custom CSS where possible:
  - Spacing: `m-*`, `p-*`, `gap-*`, `mt-*`, `mb-*`, `ms-*`, `me-*`
  - Flexbox: `d-flex`, `flex-column`, `flex-row`, `justify-content-*`, `align-items-*`
  - Display: `d-none`, `d-block`, `d-md-block`, `d-lg-flex`
  - Text: `text-center`, `text-start`, `text-end`, `fw-bold`, `fs-*`
- Use mobile-first approach - write base styles for mobile, then add `@media (min-width: ...)` for larger screens
- Test layouts at all breakpoints to ensure responsive behavior
