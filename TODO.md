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
- [x] 3a. List pages: ~~projects-list, news, project-notifications~~ (done in phase 2); project shell + 7 tabs.
- [ ] 3b. Map page (`/projects`): projlist-map, filters, list, detail popup.
- [ ] 3c. Comments + add-comment + file upload + cac-unsubscribe.
- [ ] 3d. Search + content search + search-help.
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
- pages/project: `documents/detail/`, `cac/become-a-member`, `toggle-button/` dropped. No route or template in the Angular app reaches any of them.
- pages/project: the `project-unsubscribe` tab dropped. `initTabLinks` skipped it and its `display` started false, so it could never render.
- pages/project: `project.ts`'s `legislationLink`, `period` and `commentPeriod` signals dropped; nothing read them (the sidebar computes its own legislation link).
- pages/project: the shell shares the loaded project and the `List` items with its tabs through the router outlet context. Angular pushed them into `StorageService` and each tab re-read them; `commenting-tab` and `documents` also refetched the lists per row.
- pages/project: the scroll-position save/restore between `pins`/`project-activites` and `project-details-tab` dropped. It existed because the Angular router scrolled on every query-param navigation; react-router's `setSearchParams` does not move the page.
- pages/project/details-sidebar: the map initialises from a ref in an effect. Angular polled `getElementById` every 100 ms until the element appeared, then `fixMap` polled `offsetParent` every 50 ms and re-centred twice more on a timer.
- pages/project/details-sidebar: the Leaflet `featureGroup`, `fitBounds` and `defaultBounds` dropped. The map only renders when the project has a centroid, so fitting the bounds of that single marker at `maxZoom: 8` was the `setView(centre, 8)` the code already did.
- pages/project/details-sidebar: `ResizeObserver` on the map container replaces the window `resize` handler, so the sidebar's open/close animation also triggers `invalidateSize`.
- config: the chosen base map layer moved from Angular's `ConfigService` to `get/setBaseLayerName` in `config.ts`; it is session state, not env config.
- pages/project: the tab overflow arrows are JSX driven by a `ResizeObserver`, not `document.createElement` appended once per shell mount with a 100 ms retry loop and re-checks on every `NavigationEnd`.
- pages/project: one `ProjectDocumentTab` serves the Documents, Application, Certificate and Amendment tabs. The four Angular components differed only in which documents they select, whether they offer filters, and their empty message.
- pages/project: the document tabs return to page 1 when a column is sorted. Angular's Documents tab kept the page, showing a slice of the old ordering; its three siblings already reset.
- pages/project: a keyword search on a document tab keeps the current sort when the keyword itself did not change, and keeps the chosen page size. Angular reset both to `-datePosted` and dropped the page size.
- pages/project: `onResetControls` dropped from all four document tabs. `search-filter-template` already emits an empty search package on reset, which clears the keyword, every filter and the sort in one navigation.
- pages/project: `showFeatured` is passed to the rows through `tableData.data` instead of being written onto each record of the API response, which mutated the query cache.
- pages/project/pins: the table reads `/api/project/:id/pin` through a TanStack query. `api/pins.ts` — a module-scoped store with its own `fetchDataConfig` mirror of the table state — is deleted; nothing imported it.
- pages/project: the unstyled `spinner-container`/`spinner-new rotating` markup in `featured-documents` and `pins` dropped. Neither class is defined anywhere in the app, so it rendered as bare divs; `TableTemplate` already shows a spinner while loading.
- pages/project: `decisions-tab` renders nothing. Its Angular template was entirely commented out; the route is kept so `/p/:projId/decisions` still resolves.
- pages/project: `project-details-tab-{sm,md-lg}.component.css`, `application.component.css`, `project-activites.component.css` and `decisions-tab.component.css` not ported. No template in those components carries the selectors they define.
- pages/project: `services/storage.service.ts` (project preload cache) and `services/project-filter.service.ts` are left for phase 3b. Only `projects.component` — the map page — uses what remains of either.
