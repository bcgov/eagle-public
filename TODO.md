# React migration (branch `react`)

Angular source of truth for behaviour: `/root/repos/eagle-public` (branch `develop`, read-only). This worktree holds the React rewrite. Old Angular `src/` is removed on this branch once phase 1 lands; read the original from the develop checkout.

## Stack (decided 2026-08-27)

- Vite 8, React 19, TypeScript strict, react-router 7 (data router), TanStack Query 5.
- Vitest + jsdom + @testing-library/react. Keep `yarn test`, `yarn lint`, `yarn build` script names.
- Styles: port existing global CSS unchanged (bootstrap.min.css, `src/assets/styles/**`, BCSans, material icons). Component CSS becomes plain global CSS files imported by the component (`:host` becomes a root class). No CSS modules, no design-system library yet.
- Leaflet + markercluster stay CDN globals in `index.html` (typed via `src/types/global.d.ts`).
- `env.js` + `/api/config` runtime config pattern unchanged. `index.html` keeps `<script src="env.js">` before the app bundle.
- Build output must stay `dist/eagle-public/browser` with entry chunk named `main-[hash].js` (deploy workflows `deploy-azure-*.yaml` grep for both). Do not edit workflows.
- Node 24, Yarn 4.12 (Corepack). Never npm.
- No `any` unless the Angular source had it. ESLint flat config: @eslint/js, typescript-eslint, react-hooks, react-refresh.

## Layout

```
src/
  main.tsx            bootstrap: load config, init analytics, createRoot
  index.html moved to repo root (Vite convention); env.js copied to dist root via public/
  app/
    routes.tsx        route table (mirror app.routes.ts)
    api/              api.ts port (fetch wrapper, endpoints, search routing), query hooks
    config/           config.ts (env.js + /api/config), logging
    analytics/        analytics.ts + penguin plugin (ported near-verbatim)
    models/           ported as-is
    utils/            constants, utils, word-html-sanitizer, newlines, list-converter
    components/       shared UI (table engine, filters, pagination, toast, date-picker, ...)
    pages/            one dir per route
    layout/           header, footer, app shell
```

## Phases

- [ ] 1. Scaffold + foundation + shell + static pages + placeholder pages for every route. Build, lint, test green.
- [x] 2. Table/filter engine + pagination + query-param sync (`components/table`, `components/filters`).
- [ ] 3a. List pages: ~~projects-list, news, project-notifications~~ (done in phase 2); project shell + 7 tabs.
- [x] 3b. Map page (`/projects`): projlist-map, filters, list, detail popup.
- [ ] 3c. Comments + add-comment + file upload + cac-unsubscribe.
- [x] 3d. Search + content search + search-help.
- [ ] 4. Parity pass, a11y, delete leftovers, README/CLAUDE.md update.

## Port rules (added 2026-08-27)

- Do not port bugs or inefficiencies. When the Angular code is wrong, wasteful (redundant fetches, N+1, dead caches, needless re-renders), or dead, fix or drop it in the port.
- Every deliberate behaviour change goes in the Deviations list below, one line: file, what changed, why. Parity tests against prod may flag these; the list explains them.
- Cut dependencies where a native API or a few lines do the job. Justify each dependency kept in `package.json` by real use; remove anything unused.

## Deviations from Angular behaviour

- api: dead `comment.getById` / `project.getById` caches removed (never assigned, every call refetched anyway).
- api: `event.service` error bus dropped; no subscribers existed. Callers log directly.
- api: `date-input/` component dropped; no consumer anywhere in the Angular app.
- assets: `styles/components/datepicker.css` deleted; it only styled ng-bootstrap's calendar, which the native `<input type="date">` replaces.
- filters: `subsets`, `attachPanelToDiv`, `advancedFilterTitle`/`advancedFilterText` and the Checkbox / RadioPicker / SliderToggle / Dropdown filter types dropped; no consumer in the Angular app uses any of them. The `FilterType` enum keeps every member.
- filters: `skipNextSearch` in `search-filter-template` dropped; nothing ever set it true.
- filters/custom-multi-select: search box focus and option highlight are per-instance; Angular queried `document` globally, so two selects on one page fought over focus.
- table/table-object: `ITableOptions.rowSpacing` kept as a field but still unread — no CSS or template ever consumed it in Angular either.
- table/table-params: `toggleSortDirection` matches the whole field name. Angular used `currentSort.includes(field)`, so sorting `name` while sorted by `+displayName` flipped instead of starting fresh.
- table/table-params: a `sortBy` that `URLSearchParams` form-decoded from `+name` to `" name"` is restored to `+name`. Angular's router never form-decoded, so its deep links need this on the way in.
- table/table-list: a filter or keyword search keeps the current `pageSize`. Angular rebuilt the params without it, dropping the user's page-size choice on every filter change.
- table/table-list: the table request no longer waits for the filter option lists (orgs, `List`) to load; the request only needs URL params, so the two now run in parallel.
- pages/project-list: `useGroup` / `LEGISLATION_FILTER_GROUP` dropped. `autocomplete-multi-select` grouped on `filterDefinition.group`, which project-list never set, so the flag grouped nothing. Rendering is unchanged.
- pages/project-list: `project-list.component.css` dropped; every selector in it (`.project-table__*-col`, `.project-table__project-details*`, `.project-list__options`, `.loading-overlay`) is unused by any template in the app.
- pages/project-notifications: the comment-period lookup runs once per notification. Angular fetched it on row init to decide whether to show the Engagement tab, then fetched the same URL again when the tab opened.
- pages/project-notifications: `.skeleton-cell` and its shimmer are now in this page's CSS. In Angular they lived in `commenting-tab`, a different component with view encapsulation, so the notification skeleton rendered unstyled.
- pages/project-notifications: sorting the documents sub-table returns to page 1. Angular kept the current page, showing a slice of the old ordering.
- pages/search: `search.component.css` dropped. Every selector in it was dead under Angular's view encapsulation (the template is a single `<app-table-list>`); the one live rule was the `::ng-deep` hero-banner background, now passed as `heroBanner.backgroundImage` like every other list page.
- pages/search: `search-document-table-rows.component.css` keeps `.download-icon` only; `.download-icon-wrap` matched nothing in the template.
- pages/search: the download icon gets `role="button"`. It was already a focusable span with a keyup handler and an aria-label, so screen readers announced it as plain text.
- pages/search: `LEGISLATION_FILTER_GROUP.labelPrefix`/`labelPostfix` are kept on the group object but unread — Angular's multi-select only ever passed `group.name` as the groupBy key.
- pages/content-search: an empty result set now clears the list and shows "No documents contain that text". Angular's table-service subscriber returned early on an empty payload (`res.data === 0`), leaving the previous search's cards on screen under the new keyword.
- pages/content-search: a keyword search keeps the current `pageSize`, matching the table-list fix above. Angular rebuilt the params without it.
- pages/content-search: snippets are escaped and re-opened for `<mark>` only before `dangerouslySetInnerHTML`. eagle-search already escapes them, but Angular's `[innerHTML]` ran the DomSanitizer over the result and React's has no equivalent, so that guard is restored in three lines rather than dropped.
- state/map-ui: ConfigService's `mapBounds` getter dropped; nothing in the app ever read it.
- state/map-ui: `storage.service` dropped. Its background preload was never called from anywhere, and TanStack Query's cache already gives "fetch the project list once, reuse it on the way back".
- pages/projects: the `no-scroll` body class handling is gone; the app only ever removed that class, never added it.
- pages/projects: a failed project load leaves the page showing "No projects found" instead of redirecting to the home page. `api/project` already degrades a failed search to an empty list, so the redirect only hid the failure.
- pages/projects: filters are no longer cleared when leaving the page — the URL holds them, so navigating away drops them anyway. Angular's `clearAll()` on destroy also skipped the URL, leaving a stale query string behind.
- pages/projects: filter state lives only in the URL, so the filter bar has no second copy to fall out of step with it.
- projects/projlist-filters: `clearAllFilters` dropped; no template called it, and it cleared the filter signals without updating the URL.
- projects/project-filter: the type filter resolves the dropdown's camelCase code (`energyElectricity`) to its display name before comparing with `project.type` (`Energy-Electricity`). Comparing the code directly never matched, so Project Type filtered nothing. URL values are unchanged.
- projects/proj-detail-popup: the comment period status reads `response.data[0]`. Angular tested `.length` on the `{ totalCount, data }` wrapper, so the "Comment Period Status" row never rendered.
- projects/proj-detail-popup: the project description goes through `sanitizeWordHtml` before rendering. Angular bound it raw through `[innerHTML]`.
- projects/projlist-list: the card's details link points at `/p/:id`. Angular linked `/a/:id`, which matches no route and fell through to the home-page redirect.
- projects/projlist-map: marker visibility is no longer tracked per marker in a store. Only "exactly one marker in view" — the single thing that read it, for popup auto-open — is recomputed on map move.
- projects/projlist-map: the map is created immediately and a `ResizeObserver` calls `invalidateSize` (and replays a fit that came before the container had a size). Angular polled the container every 50 ms and defined the observer but never wired it up.
- projects/projlist-map, projlist-list: the `name` attribute on the map and list `div`s became `aria-label`; `name` is not valid on a `div`.
- projects/projects.css: `.toggle-app-list-btn` rules dropped; no template renders that button.
- projects/projlist-filters: the search box keeps its raw text locally and writes the trimmed value to the URL, so a space typed between words survives.
