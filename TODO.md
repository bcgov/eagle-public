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
- [x] 2.5 parity loop passed (states 01, 02, 05, 06 at 924 and 400) (feat/unified-search-p2; `yarn test:parity` is 65 pass / 0 fail / 18 skip, every captured state green at both widths. The card height gap closed in `display-grid.css`: the card gap is the design's 5px, the last card keeps its rule, and the narrow bar drops the second border. Two deviations recorded in `docs/unified-search-plan.md`: the projects card at 400 leaves out the design's Legislation pair, hidden capture-side because the projects index has no legislation field, and documents sharing a posted date come back in the server's order. Note: `yarn parity:fixtures` would regenerate `documents.json` in prototype order and put the two 2023-03-14 documents back the other way round, failing state 01; re-apply the swap by hand after a regeneration)
- [ ] 2.6 a11y pass; PR, review, merged, beta on next (in progress: PR #882 open; a11y audit done, 8 markup findings fixed; border contrast and CustomMultiSelect in follow-ups; review round 1 PASS with 4 fixes applied; scrollbar styled on `.display-grid__scroll`; 7ff8db8d adds the Name/Project text filter cell on `and[nameContains]` (needs eagle-demi PR #393 on test), fixes the 22388f76 review findings, and matches the from/to date labels and picker header; d465a510 matches the picker rows (state 06 passes) and keeps the head mounted on a filtered empty result; parity is green at both widths, see 2.5; Playwright e2e 79 pass against a preview; re-review of d7243b70 PASS; Author ids on test are a data gap, fix is `seed-public-reads.js --only lists` against prod on demi-devbox-test)
- [ ] 2.7 "Inside documents" content search on the documents tab moves up from Phase 4 if wanted before beta

Phase 3, activities + notifications:

- [x] 3.1 `types/activities.ts` list rows, attachments + spec (`types/activities.tsx`: meta line, excerpted body and the one file `documentUrl` names; the Documents attached filter removes itself when the index says it has no such field; the toolbar counts these records as "updates")
- [x] 3.2 `types/notifications.ts` headerless + spec; fixture (cards with the Documents and Engagement tabs the old page had, keyboard-reachable; `ProjectNotification` rows added to the demi-search fixture)
- [x] 3.3 `/news`, `/project-notifications` redirects; home links; old pages and specs removed (both addresses redirect to `/search`, the home and project links point at the new ones, and the two page components, configs and specs are deleted)
- [x] 3.4 parity loop passed (state 03 and notifications tab at both widths) (`yarn test:parity` is 67 pass / 0 fail / 16 skip. State 03 needed two changes: the reference is recaptured with one attachment per activity and no type or size beside it, because a `RecentActivity` carries a single `documentUrl`, and the app no longer draws an empty type/size element, which was taking a line of its own on a phone and left the page 8px taller than the design)
- [ ] 3.5 PR, review, merged, beta on next (in progress: PR #884 at b722fa9d, base #882; CI green; review PASS after the subscribe control moved to the activities tab, the tab-change crash and the loading flash were fixed; merge waits on #881 and #882; no beta tag until asked)

Phase 4, inside documents:

- [x] 4.1 scope switch, `DocumentChunk` query, sort swap/restore (documents tab only, behind `CONTENT_SEARCH`; `scope=inside` queries the chunk dataset with `prefix=false` and `sortBy=-score`, which is how demi-search is told to issue no `$orderby`. The URL spells the order `-matches` and the sort select offers "Most matches" alone: every field of the chunk index is `sortable: false`, so no other order is real. `and[nameContains]` is dropped in the scope — the API 400s on it there — and the column filter goes with it; the other four facets, the date range, legislation and featured are all expressible on chunks, measured against test. Selection and bulk download work in the scope too, keyed by document id, so a selection survives the switch. The Documents pill in the scope shows this search's own total, the prototype's rule, so the badge matches the list under it. Snippets arrive with the API's `<mark>` wrappers around each hit; those are stripped and the passage list marks the terms itself)
- [x] 4.2 `passage-list.tsx` + spec, `PASSAGE_LOCATOR` constant, `pageNumbered` hook (`passage-locator.ts` labels "Passage N" by the passage's place in its row until a row carries `pageNumbered`, then "Page N" and the file link gains `#page=N`; two passages shown, then "N more passages" / "Show fewer passages"; a checkbox per row when bulk download is on)
- [x] 4.3 no-keyword prompt, cross-scope empty states (the prompt reads "Search inside the documents" with "N documents indexed" from the type counts and no pager. The cross-scope offer is one extra `pageSize=1` search, issued only where the current scope came back empty. Two deviations from the prototype copy: the prompt does not promise "the page it appears on", because the index records passage sequence numbers and not PDF pages, and the meta line under a file name is date and type with no author, because a chunk row carries none. Both close when the index carries real pages, Phase 7)
- [x] 4.4 `content-search.tsx`/`content-result.tsx` retired (with their CSS, specs, `search-tabs.ts` and `contentSearchLoader`; `/search/content` redirects through `legacy-search.ts` to the inside scope, keyword and paging intact. `css-scoping.spec.ts` carried no rule for the page, so nothing to remove there. `contentSearchEnabled()` stays as the gate on the switch)
- [x] 4.5 parity loop passed (state 04) (two rounds; 71 states pass, 0 fail, 14 skipped for phase 5. The fixtures answer `dataset=DocumentChunk` from `chunks.json`, grouped into document rows the way `group-chunks.js` does; the fixture config sets `CONTENT_SEARCH: true`, without which the switch never renders and the state skips. Round 1: the Documents pill, row checkboxes and the "matching" suffix in the app; the author segment and page labels rewritten capture-side in `capture-reference.ts`, both asserted, references regenerated at the same heights. Round 2: the hit mark takes the design's `padding: 0 1px; border-radius: 2px`, the passage row keeps the locator beside the text at every width, and the row checkbox is a plain flex item so it shrinks to 13px on a phone as the prototype's does. `documents.json` keeps d9 before d8; `parity:fixtures` would swap them back)
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

Follow-ups from phase 3, none of them blocking:

- The sort select on a list offers only Newest first and Oldest first. `sortOptionsFor` in `display-grid.tsx` takes the name option from the first column carrying `link`, which on the activities list is the project rather than the update headline, and that column is not sortable.
- The gold underline under the active tab in `tab-nav.css` measures 1.72:1 against white, below the 3:1 a non-text indicator needs. It is the pattern the whole app uses, so changing it is a site-wide decision rather than a search one.
- A project notification title is not a link to its project. The old page did not link it either, but the activities rows beside it do.
- The tab lists in `content-search.tsx:84` and `table-list.tsx:161` do not move focus with the arrow keys and carry no `aria-controls`. Fix them with the `moveFocus` helper in `notification-row.tsx`, moved somewhere both can read it.
- The Show more button in `list-row.tsx` has no `aria-controls` naming the body it expands.
- `headerless` does nothing for `template: 'list'`: a list has no head to drop. Either the flag is read there or the list configs stop setting it.

Follow-ups from phase 4, none of them blocking:

- The scope switch and the record-type pills are single-choice controls built as `role="group"` buttons with `aria-pressed`. A radiogroup (`role="radio"`, `aria-checked`) says "one of a set" where a pressed toggle does not.
- Row titles in `list-row.tsx` and `passage-list.tsx` are `h3` under the page `h1` with no `h2` between.
- The row checkbox is 16px, and 13px in the passage list on a phone where the prototype lets it shrink; both sit under the 24px target size. A design decision, the grid tables share it.
- File links in `record-link.tsx` open a new tab with no "opens in a new tab" cue in the name.
- In the inside scope the sort select offers "Most matches" alone; the select could hide when it has one option.
- The site header "Search" item is not active on `/search` (it still points at `/projects-list`); the prototype draws it active. Phase 6.1 moves the link and closes the gap on every parity state.

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
