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
    analytics/        analytics.ts + penguin plugin (ported near-verbatim)
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
- [x] 3c. Comments + add-comment + file upload + cac-unsubscribe.
- [x] 3d. Search + content search + search-help.
- [x] 4. Parity pass, a11y, delete leftovers, README update.
  - [x] 4a. Phase-3 findings (project card fields, `fields=[object Object]`, CAC location), dependency audit, leftovers, a11y basics, docs.
    - [x] `models/project.ts` fields that no payload carries.
    - [x] `&fields=` dropped from the search request.
    - [x] CAC `caclocationInput` — investigated, see Follow-ups.
    - [x] Dependency audit; `bootstrap.bundle.min.js` no longer shipped.
    - [x] Leftovers deleted (`assets/styles/layout/`, retina marker icons, dead badge CSS).
    - [x] a11y: skip link, `aria-live` toast container, popup CTA is a real `<button>`.
    - [x] `README.md` describes the React stack.
  - [x] 4b. Parity run against prod (`e2e/` against `https://projects.eao.gov.bc.ca` data, 2026-08-27).
    - [x] Dev proxy follows `API_LOCATION` from the environment, `/demi-search` included, so a run can point at prod without prod URLs in `src/env.js`.
    - [x] Playwright suite green; the two request-baseline diffs (`&fields=`, pins `sortBy`) are Deviations, applied in `e2e/support/helpers.ts`.
    - [x] CSS scoping regressions fixed: `header.css`, `home.css`, the popup `hr` and the table pagination rules leaked or lost to Bootstrap once view encapsulation went away.
    - [x] Map opening view matches prod again (fit padding), and the map page footer is prod's.

## Port rules (added 2026-08-27)

- Do not port bugs or inefficiencies. When the Angular code is wrong, wasteful (redundant fetches, N+1, dead caches, needless re-renders), or dead, fix or drop it in the port.
- Every deliberate behaviour change goes in `docs/deviations-from-angular.md`, one line: file, what changed, why. Parity tests against prod may flag these; the list explains them.
- Cut dependencies where a native API or a few lines do the job. Justify each dependency kept in `package.json` by real use; remove anything unused.

## Cutover prerequisites

- Bulk download needs eao-nginx v2.7.29+ and the eagle-edge bulk-downloads patterns on prod before the React cutover; until then the UI is staging-only.

## Ports pending

Fixes shipped on `develop` (Angular) not yet re-implemented here. One line each: tag, commit, what. Delete the line when ported.

- none

## Follow-ups

- Unscheduled ideas live in `docs/FUTURE.md` (per-branch preview URLs, automatic create and teardown).
- Assessment rail (`src/app/pages/project/assessment-stages.ts`) has no per-stage dates. Historic stages should scale to how long they actually took and only current and future stages show the statutory maximum, but eagle-api holds no phase dates (`phaseHistory` is bare List ids). Source is Track `work_phases` (start_date, end_date, number_of_days, legislated) through a demi-api endpoint, for example `GET /api/projects/:id/phases`; fill `elapsedDays` and `dates` from it. Same feed can carry the certificate number (`ea_certificate` in DEMI Track data). Never through eagle-api.
- After cutover, delete `e2e/tools/` and `e2e/tests/css-scoping.spec.ts`. Both only compare the Angular and React renderings, so neither has anything to check once Angular is gone.

- CAC sign-up drops the Location field. `add-comment.tsx` collects `caclocationInput` but does not send it, and sending it would change nothing: eagle-api's `publicCACSignUp` (`api/controllers/cac.js`) casts the body through `new CACUser(...)`, and `api/helpers/models/cacUser.js` has no location path — mongoose would strip it. `CACObject` in swagger declares only `name`, `email` and `comment`. Fixing this needs an eagle-api change (add the field to the model and the swagger definition) before the frontend can send it. Angular had the same gap.
- `luxon` kept. `models/commentperiod.ts` does America/Vancouver arithmetic, not formatting: `endOf('day')` in Pacific, `minus({days: 7})`, `plus({days: 7})`, `diff(now, 'days')`, hour/minute reads in Pacific and a `ZZZZ` zone name. `Intl.DateTimeFormat` formats in a zone but cannot do zone-aware arithmetic across DST, and `Temporal` is not available. Revisit when `Temporal` ships.
- Non-interactive `tabIndex={0}` on `<td>` in `pins` and `activity-card` is an Angular-era idiom that puts unactionable content in the tab order (WCAG 2.4.3). `jsx-a11y/no-noninteractive-tabindex` does not flag table cells, so lint will not catch it; it needs a decision on how those tables should be navigated.
- Project reads are split across two backends: demi-search serves the project list and every document query, eagle-api serves the project record, pins, comment periods and activities, so the two corpora can disagree. Why, and what has to happen to close it: `eagle-demi/docs/FUTURE.md`, "Serve eagle-public's project reads".
