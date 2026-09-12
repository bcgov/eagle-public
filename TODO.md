# React migration (branch `react`)

Angular source of truth for behaviour: the `develop` checkout, read-only. This branch holds the React rewrite. Old Angular `src/` is removed on this branch once phase 1 lands; read the original from the `develop` checkout.

## Stack (decided 2026-08-27)

- Vite 8, React 19, TypeScript strict, react-router 7 (data router), TanStack Query 5.
- Vitest + jsdom + @testing-library/react. Keep `yarn test`, `yarn lint`, `yarn build` script names.
- Styles: port existing global CSS unchanged (bootstrap.min.css, `src/assets/styles/**`, BCSans, material icons). Component CSS becomes plain global CSS files imported by the component (`:host` becomes a root class). No CSS modules, no design-system library yet.
- Maps: MapLibre GL 6 with the `@vis.gl/react-maplibre` binding, installed and bundled. No map library from a CDN.
- `env.js` + `/api/config` runtime config pattern unchanged. `index.html` keeps `<script src="env.js">` before the app bundle.
- Build output must stay `dist/eagle-public/browser` with entry chunk named `main-[hash].js` (deploy workflows `deploy-azure-*.yaml` grep for both).
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
    analytics/        analytics.ts (eagle-analytics client only; penguin plugin removed)
    models/           ported as-is
    utils/            constants, utils, word-html-sanitizer, newlines, list-converter
    components/       shared UI (table engine, filters, pagination, toast, date-picker, ...)
    pages/            one dir per route
    layout/           header, footer, app shell
```

## Phases

- [x] 1. Scaffold + foundation + shell + static pages + placeholder pages for every route. Build, lint, test green.
- [x] 2. Table/filter engine + pagination + query-param sync (`components/table`, `components/filters`).
- [x] 3a. List pages: ~~projects-list, news, project-notifications~~ (done in phase 2); project shell + 7 tabs.
- [x] 3b. Map page (`/projects`): projlist-map, filters, list, detail popup.
- [x] 3c. Comments + cac-unsubscribe. (Add-comment and file upload were removed later; ENGAGE owns comment submission.)
- [x] 3d. Search + content search + search-help.
- [x] 4. Parity pass, a11y, delete leftovers, README update.
  - [x] 4a. Phase-3 findings (project card fields, `fields=[object Object]`), dependency audit, leftovers, a11y basics, docs.
    - [x] `models/project.ts` fields that no payload carries.
    - [x] `&fields=` dropped from the search request.
    - [x] Dependency audit; `bootstrap.bundle.min.js` no longer shipped.
    - [x] Leftovers deleted (`assets/styles/layout/`, retina marker icons, dead badge CSS).
    - [x] a11y: skip link, `aria-live` toast container, popup CTA is a real `<button>`.
    - [x] `README.md` describes the React stack.
  - [x] 4b. Parity run against prod (`e2e/` against `https://projects.eao.gov.bc.ca` data, 2026-08-27).
    - [x] Dev proxy follows `API_LOCATION` from the environment, `/demi-search` included, so a run can point at prod without prod URLs in `src/env.js`.
    - [x] Playwright suite green; the two request-baseline diffs (`&fields=`, pins `sortBy`) are Deviations, applied in `e2e/support/helpers.ts`.
    - [x] CSS scoping regressions fixed: `header.css`, `home.css`, the popup `hr` and the table pagination rules leaked or lost to Bootstrap once view encapsulation went away.
    - [x] Map opening view matches prod again (fit padding), and the map page footer is prod's.

## Unified search (PUBLIC-146)

One `/search` page and one display grid replacing `/projects-list`, `/search`, `/news` and `/project-notifications`. Plan and detail: `docs/unified-search-plan.md`.
The design prototype sits at `design/handoffs/unified-search/`, local only and never committed; the source archive is kept at `/root/repos/eagle-public-design-handoff.zip` and can be unzipped again if the directory is missing.

Picking up the work:

- Start by reading this section and `docs/unified-search-plan.md`.
- Take the first unchecked item whose dependencies are already ticked.
- One item at a time. Never redo a ticked item.
- Tick an item only when its exit condition holds (tests green, parity passed where it applies, PR open). Partial work goes on the line as `(in progress: <branch>, <what is done>)`, never as a tick.
- Branch per phase: `feat/unified-search-p<N>` off `react`, worked in its own worktree.

Phase 1, grid components:

- [x] 1.1 `display-grid.tsx`, `grid-header`, `filter-row`, `year-picker`, `display-grid.css` with z-index scale
- [x] 1.2 `value-picker` (fixed, flip, close rules) + spec
- [x] 1.3 `chip-row`, `advanced-filters` (date validation) + specs
- [x] 1.4 `grid-toolbar` (count, scope slot, More filters, Columns, Copy link, selection swap) + spec
- [x] 1.5 `list-row`, `highlight` + specs
- [x] 1.6 `use-grid-url-state` + spec
- [x] 1.7 parity harness: fixtures from prototype, `capture-reference.ts`, `test:parity` script, reference PNGs committed
- [ ] 1.8 `css-scoping.spec.ts` assertions; PR open, review, merged, `v3.0.0-beta.N` on next (in progress: feat/unified-search-p1, PR open)

Phase 2, `/search` projects + documents:

- [x] 2.1 `types/projects.ts`, `types/documents.ts`, `types/index.ts` + specs (`and[]` contract)
- [x] 2.2 `use-type-counts.ts` with 404 fallback + spec
- [x] 2.3 `unified-search.tsx` composes grid; URL schema; analytics unchanged (feat/unified-search-p2)
- [x] 2.4 route swap, old search page deleted, e2e rewritten (feat/unified-search-p2; e2e 79 passed)
- [x] 2.4a `routes/legacy-search.ts` param mapping + table-driven spec (Angular `/projects-list`, bare `/search` disambiguation)
- [x] 2.4b hash-router guard (`#/...`) + e2e
- [ ] 2.5 parity loop passed (states 01, 02, 05, 06 at 924 and 400) (in progress: feat/unified-search-p2; 3 rounds run, cap reached; 12 states still fail: reference footer carries the legacy footer.css spacing (18px), and the fourth pill, the Inside documents segment and the name text filter are known deviations; product decision needed before the gate can pass)
- [ ] 2.6 a11y pass; PR, review, merged, beta on next (in progress: PR #882 open; a11y audit done, 8 markup findings fixed; border contrast and CustomMultiSelect in follow-ups; review round 1 PASS with 4 fixes applied; scrollbar styled on `.display-grid__scroll`; open items: Name/Project text filter cell empty, needs demi-search `and[nameContains]` (eagle-demi branch feat/name-contains-filter); state 06 picker opens live (fixed, 232px) but the fullPage parity capture drops it, harness fix needed; Author ids on test are a data gap, fix is `seed-public-reads.js --only lists` against prod on demi-devbox-test)
- [ ] 2.7 "Inside documents" content search on the documents tab moves up from Phase 4 if wanted before beta

Phase 3, activities + notifications:

- [ ] 3.1 `types/activities.ts` list rows, attachments + spec
- [ ] 3.2 `types/notifications.ts` headerless + spec; fixture
- [ ] 3.3 `/news`, `/project-notifications` redirects; home links; old pages and specs removed
- [ ] 3.4 parity loop passed (state 03 and notifications tab at both widths)
- [ ] 3.5 PR, review, merged, beta on next

Phase 4, inside documents:

- [ ] 4.1 scope switch, `DocumentChunk` query, sort swap/restore
- [ ] 4.2 `passage-list.tsx` + spec, `PASSAGE_LOCATOR` constant, `pageNumbered` hook
- [ ] 4.3 no-keyword prompt, cross-scope empty states
- [ ] 4.4 `content-search.tsx`/`content-result.tsx` retired
- [ ] 4.5 parity loop passed (state 04)
- [ ] 4.6 PR, review, merged, beta on next

Phase 5, help + tour:

- [ ] 5.1 `search-help-dialog.tsx` + spec
- [ ] 5.2 `guided-tour.tsx`, `tour-steps.ts`, absent-step skip + spec
- [ ] 5.3 parity loop passed (states 07, 08, tour steps 2-7)
- [ ] 5.4 PR, review, merged, beta on next

Phase 6, nav + retirement:

- [ ] 6.1 header Search → `/search`
- [ ] 6.2 `project-document-tab.tsx` on `DisplayGrid`; `data-table/*` deleted; parity re-run on project documents tab against `Project Page - Redesign.dc.html` documents tab
- [ ] 6.3 old pages/configs deleted; `TableList` kept for comments + notification documents; TODO line for those two
- [ ] 6.4 `deviations-from-angular.md`, wiki routes table
- [ ] 6.5 PR, review, merged, beta on next

Phase 0 (counts endpoint, index gaps) and Phase 7 (real page numbers) are tracked in eagle-demi `TODO.md` under the same heading.

Follow-ups from the phase 2 review, none of them blocking:

- `CustomMultiSelect`, which the value picker uses above 40 options, is a div combobox without the ARIA 1.2 structure. Rebuild it on a real input with `aria-activedescendant`.
- `list-row.tsx` renders an `<h3>` under the page `h1` with no `h2` in between. Add a results `h2` before activities and notifications ship on the list template.
- `api.ts:323` concatenates `sortBy` unencoded, so `+name` reaches the wire as ` name`. Encode it once the backend contract is confirmed.
- Move the column `sortable` flags and the cell renderers out of `unified-search.tsx` into the type configs.

## Port rules (added 2026-08-27)

- Do not port bugs or inefficiencies. When the Angular code is wrong, wasteful (redundant fetches, N+1, dead caches, needless re-renders), or dead, fix or drop it in the port.
- Every deliberate behaviour change goes in `docs/deviations-from-angular.md`, one line: file, what changed, why. Parity tests against prod may flag these; the list explains them.
- Cut dependencies where a native API or a few lines do the job. Justify each dependency kept in `package.json` by real use; remove anything unused.

## Cutover prerequisites

- Bulk download needs eao-nginx v2.7.29+ and the eagle-edge bulk-downloads patterns on prod before the React cutover; until then the UI is staging-only.
- The app asks eagle-api for nothing. Prod cannot take this bundle until both of these are true, because there is no fallback left:
  - The prod config document carries `SEARCH_API_PATH=/demi-search`, `DEMI_PROJECTS_PATH=/demi-projects`, `CONFIG_PATH=/demi-search/config` and `EAGLE_ANALYTICS_URL=/analytics`.
  - The prod rproxy serves `/demi-search/gate` and `/demi-search/documents/*` on top of what it already proxies (eao-nginx v2.7.37).
- DEMI prod needs `ACCESS_GATE_PASSWORD` set only if the prod gate is ever turned on. Prod ships `ACCESS_GATE` false, so it is not a blocker.

## Ports pending

Fixes shipped on `develop` (Angular) not yet re-implemented here. One line each: tag, commit, what. Delete the line when ported.

- none

## Follow-ups

- Display grid: control borders in `display-grid.css` (`--theme-gray-50`, 1.55:1), the same token on the unselected record pill in `unified-search.css`, and the inactive sort arrow (`--theme-gray-60`, 1.54:1) follow the design handoff and sit under the 3:1 non-text contrast floor (WCAG 1.4.11); needs a design decision before the grid ships to prod.
- Unscheduled ideas live in `docs/FUTURE.md` (per-branch preview URLs, automatic create and teardown).
- After the prod cutover of the unified search page, submit the new `/search` URL to the search engines. The client redirects keep old indexed links working in the meantime.
- Assessment rail (`src/app/pages/project/assessment-stages.ts`) has no per-stage dates. Historic stages should scale to how long they actually took and only current and future stages show the statutory maximum, but eagle-api holds no phase dates (`phaseHistory` is bare List ids). Source is Track `work_phases` (start_date, end_date, number_of_days, legislated) through a demi-api endpoint, for example `GET /api/projects/:id/phases`; fill `elapsedDays` and `dates` from it. Same feed can carry the certificate number (`ea_certificate` in DEMI Track data). Never through eagle-api.
- After cutover, delete `e2e/tools/` and `e2e/tests/css-scoping.spec.ts`. Both only compare the Angular and React renderings, so neither has anything to check once Angular is gone.

- `luxon` kept. `models/commentperiod.ts` does America/Vancouver arithmetic, not formatting: `endOf('day')` in Pacific, `minus({days: 7})`, `plus({days: 7})`, `diff(now, 'days')`, hour/minute reads in Pacific and a `ZZZZ` zone name. `Intl.DateTimeFormat` formats in a zone but cannot do zone-aware arithmetic across DST, and `Temporal` is not available. Revisit when `Temporal` ships.
- Non-interactive `tabIndex={0}` on `<td>` in `pins` and `activity-card` is an Angular-era idiom that puts unactionable content in the tab order (WCAG 2.4.3). `jsx-a11y/no-noninteractive-tabindex` does not flag table cells, so lint will not catch it; it needs a decision on how those tables should be navigated.
- Project reads all come from demi-search now, so the two corpora can no longer disagree. Background on why the split existed: `eagle-demi/docs/FUTURE.md`, "Serve eagle-public's project reads".
