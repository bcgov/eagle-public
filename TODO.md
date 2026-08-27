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
