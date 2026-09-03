# EPIC public site parity tests

Playwright suite that pins the behaviour of the public EPIC site. It runs against a local
production build or against a deployed environment. Nothing here imports application code.

## Run

Against the local build, which is what CI does:

```bash
yarn build                                                    # from the repo root
cd e2e
yarn install                                                  # first time only
BASE_URL=http://localhost:4173 yarn test
```

A `BASE_URL` on port 4173 makes Playwright start the server itself (`webServer` in
`playwright.config.ts`): `vite preview`, serving `dist/eagle-public/browser` with the dev server's
proxy rules, so `/api`, `/demi-search`, `/analytics`, `/eagle-search` and `/notify-api` reach the
same backends as `yarn start`. Build first, or preview has nothing to serve. It reuses a server
already listening on 4173 unless `CI` is set. Every other `BASE_URL`, a dev server on 4200
included, is left alone.

Against a deployed environment:

```bash
cd e2e
yarn test                                                     # prod (default)
BASE_URL=https://test.projects.eao.gov.bc.ca yarn test        # test environment
BASE_URL=http://localhost:4200 yarn test                      # a dev server you started
yarn playwright test --grep-invert @data                      # skip live-data-volume tests
yarn playwright test tests/search.spec.ts                     # one file
yarn report                                                   # open the HTML report
```

`yarn test` runs only when `BASE_URL` is set, so the pre-push verifier never drives production by
accident; it also forwards no arguments, so pass extra flags to `yarn playwright test`.
`yarn playwright test` on its own defaults to `https://projects.eao.gov.bc.ca`. Browsers come from
`/root/.cache/ms-playwright`; no download step is needed.

The `e2e` job in `.github/workflows/pr.yaml` runs the local-build path and uploads
`playwright-report` when it fails.

The **test environment serves every HTML route and `/demi-search` behind HTTP basic auth**
(`WWW-Authenticate: Basic realm="Restricted Content"`); only `/api/*` is open. Supply the
credential to run there:

```bash
BASE_URL=https://test.projects.eao.gov.bc.ca \
BASIC_AUTH_USER=... BASIC_AUTH_PASS=... yarn test
```

Without it the whole suite fails on test with a 401 page. That is an environment gate, not a
behaviour difference.

## The password curtain

`ACCESS_GATE: true` in `/api/config` puts a shared-password page in front of the whole app, and
both test and a dev server proxying to test have it on. The flag it remembers is a plain
`localStorage['eagle-gate'] = '1'`, so `support/fixtures.ts` seeds that in an init script and
every spec that imports `test` from there sees the app rather than the curtain. Import from
`support/fixtures`, not from `@playwright/test`, in any new spec.

`tests/gate.spec.ts` is the exception: it imports the plain Playwright `test` so the curtain
renders, and exercises the real password. Give it the password:

```bash
GATE_PASSWORD=... yarn test tests/gate.spec.ts
```

Without `GATE_PASSWORD` the unlock case is skipped; the rejection and labelling cases still run.
On an environment with `ACCESS_GATE` off the whole file skips.

Retries are 1, trace is captured on the first retry.

## Baseline request capture

`baseline/requests.json` records the exact API calls each page issues, keyed by page. Normal runs
assert the page still issues exactly that set. Regenerate against prod after an intentional API
change:

```bash
cd e2e && yarn baseline        # BASELINE_WRITE=1, single worker so the file writes cleanly
```

URLs are normalised before comparison so the file stays environment-independent:

- 24-hex path segments and param values become `:id`
- ISO timestamp param values become `:ts`
- params are sorted by name, then value
- **volatile params dropped**: `cpStart[since]` and `cpEnd[until]` on `GET /api/project/:id`.
  They are `Date.now()`-derived comment-period windows and differ on every load. Nothing else was
  found to be volatile.

8 pages are recorded, 46 request lines in total: `home`, `news`, `projects-list`, `projects-map`,
`search`, `project-details-tab`, `project-documents-tab`, `comment-period-details`.

## What the port must keep

Assertions prefer roles, visible text, URLs, query params and network responses. Where the current
DOM offers no accessible handle, the test falls back to an id or class. Each fallback below is a
contract: keep the hook, or update the test in the same change.

### Ids

| Hook | Where | Used for |
|---|---|---|
| `#table-template-page-count-display-<tableId>` | plain table pages | "Showing 10 of 348 results" |
| `#table-template-page-size-picker-<tableId>` | plain table pages | rows-per-page buttons |
| `#tableTop` | home | recent activity table |
| `#applist-panel` | map page | the panel beside the map |
| `#applist-list` | map page | project list inside the panel |
| `#applist-filters` | map page | the advanced filters, `data-open` and `inert` while collapsed |
| `#applicantInput` | map page | project-name filter box |
| `#Milestone` | search advanced filters | facet combobox wrapper |
| `#emailInput` | cac-unsubscribe | email field |

### Classes

| Hook | Where | Used for |
|---|---|---|
| `.table-header-bar__count` | selectable table pages | the same line, moved into the bulk-download bar |
| `.sheet-handle`, `.app-list[data-state]` | map page, mobile | bottom sheet and its height |
| `.maplibregl-canvas` | map | the WebGL canvas MapLibre draws into |
| `.map-info` | map | the selected project's card, bottom-left of the map (desktop only) |
| `.popup-title`, `.popup-subtitle` | project card | project name and its proponent/type meta line |
| `.map-container` | project detail | the mini-map box |
| `.project-tabs .nav-tabs .nav-link` | project detail | tab strip |
| `.tab-content` | project detail | active tab body |

### Test ids

The map page carries `data-testid` hooks, because pins and clusters are `aria-hidden`
decoration over a canvas and the list is the accessible surface.

| Hook | Where | Used for |
|---|---|---|
| `project-map` | map page | the map region |
| `map-cluster` | map | a cluster bubble; `data-size` is `s`, `m` or `l` |
| `map-marker` | map | a single-project pin; `data-project-id` names the project |
| `map-popup` | map | the bottom-left card a pin or card selection opens; on mobile the selected list card expands instead |
| `project-card` | list panel | a project card; `data-project-id`, `aria-current` when selected |
| `results-count` | list panel | "348 projects in view" |

### Attribute selectors that are already semantic

- `table[aria-label="table-template"]` - every paged table.
- `td[data-label="Name"]`, `td[data-label="Download"]` - column cells. The `data-label` values are
  the visible column names and drive the responsive layout, so they are behaviour, not styling.
- Sortable column headers are `th[aria-sort]` holding a `button` named after the column; sorting is
  driven through that role+name, not through a class. A `nosort` column has no button.
- Pagination exposes `aria-label="Go to page N"` and `aria-current="page"`.

Nothing in the suite selects on `app-*` element names, `_ngcontent-*`, or any other Angular
artefact.

## Behaviour recorded as-is on prod

These are asserted because that is what prod does today. Several are defects; if the port fixes one,
the test will fail and should be updated deliberately.

- **No skip link on any route.** Recorded as a test annotation ("skip-link count"), not asserted.
- **`/search/content` redirects to `/search`.** `/api/config` on prod and test carries no
  `CONTENT_SEARCH` flag, so the route guard rewrites the URL. The test reads the flag first and
  asserts the other branch if it is ever turned on.
- **`/p/:projId/decisions` is not routable.** The deployed build alerts
  `Uh-oh, couldn't load project` and lands on `/projects`. The route exists in `app.routes.ts` but
  no tab links to it.
- **Map project cards carry no project name** - only applicant, purpose, disposition, EAO project
  number and status. Filtering is therefore asserted on the result counts.
- **`fields=[object Object]`** appears in the project detail document probes. Left in the baseline
  because it is what prod sends; fixing it is an API-contract change, not a port concern.
- **Project detail shows 3 fixed tabs** (Project Details, Commenting, Documents) plus
  Application / Certificate / Amendment(s) / Unsubscribe only when that project has the matching
  documents.
- **The open comment period's entry point is labelled "Submit Comment".** The suite was first
  recorded against a build that said "Add Comment"; the regex accepts both.
- **A milestone facet value can have no documents.** The facet list is alphabetical, so the first
  option differs by corpus. The test asserts the milestone query param and that the rendered rows
  match the response - an empty result shows "No results found" and no page-count line.
- **A document row can point at an object the environment does not hold.** test is a partial copy
  of prod's storage, so `HEAD` on the download URL answers 404 for some rows. The URL shape is
  asserted; the status is only required to be below 500 and is recorded as an annotation.

## Data parity

List and search pages assert against the response that produced them, not against hard-coded
counts:

- `page.waitForResponse` grabs the `/api/search?...` or `/demi-search/search?...` call.
- Rendered row count equals `min(pageSize, meta[0].searchResultsTotal)`.
- First row text equals the first `searchResults` entry (`name` for projects, `displayName` for
  documents).
- The "Showing X of Y" display equals the same total.
- `currentPage` in the URL is 1-based; `pageNum` on the wire is 0-based. Tests assert both.

News and project notifications assert row count and first-row text but not per-column equality:
their rows are composite cards with no per-field handles.

## Fixtures

No project, document or comment-period id is hard-coded. `support/helpers.ts` resolves them per
environment:

- `firstProjects()` - `dataset=Project`, `sortBy=+name`, take the first N.
- `projectByKeyword('Site C')` - a project with documents across several tabs.
- `latestCommentPeriod()` - newest comment period with a project. Tests branch on whether it is
  open. **No test ever submits a comment.** The cac-unsubscribe form is rendered but never posted.

## Comparing two environments

Three tools under `tools/` dump one environment so two dumps can be diffed. All three take
`BASE_URL`, `OUT` (the name to write under) and the basic-auth pair, seed the gate flag, and write
into `screenshots/`, which is gitignored.

| Tool | Writes | Use |
|---|---|---|
| `node tools/shots.ts` | `screenshots/<OUT>/<shot>-{desktop,mobile}.png` | every route at 1280x800 and 390x844, plus the map project card (the expanded list card on mobile), the mobile list sheet, the open header menus, the mobile menu, the search filters and the three add-comment pages |
| `node tools/dom-dump.ts` | `screenshots/<OUT>.dom.txt` | `tag.class \| text` for every element, framework wrapper elements dropped, so an Angular tree and a React tree line up under `diff` |
| `node tools/style-dump.ts` | `screenshots/<OUT>.styles.json` | ~50 computed properties per element; `python3 tools/style-diff.py a.styles.json b.styles.json` aligns the two and prints only what differs |

Two smaller tools answer "why" once a diff points at an element:
`node tools/probe.mjs <url> <selector> [property ...]` prints its computed values and box, and
`node tools/rules.mjs <url> <selector> <property>` prints every CSS rule that sets that property on
it, in cascade order.

`WIDTH` / `HEIGHT` change the viewport for the two dumps (they default to 1280x800; the mobile pass
uses `WIDTH=390 HEIGHT=844`). `ONLY=<regex>` limits `shots.ts` to matching shot names.

The style diff is what finds the port's characteristic defect: Angular scoped every component
stylesheet with a `[_ngcontent]` attribute on its last compound selector, so a rule reached only
that component's own markup and carried one extra unit of specificity. As plain global CSS a rule
can reach a child component's markup, and it can lose a cascade fight it used to win. Both show up
as one line of computed-style difference rather than a screenshot to squint at.

## Checking a dev server

One tool asserts behaviour on a running dev server rather than comparing environments. It takes
`BASE_URL` (default `http://localhost:4200`) and `PROJECT_ID`, prints one line per assertion and
exits non-zero if any of them failed. `--help` prints the full list.

| Tool | Checks |
|---|---|
| `node tools/verify-bulk-download.js` | the document table header bar (full table width, no gap to the grid, the same height and grid offset in every selection state at 1920, 1400 and 390, on both the documents tab and search, with Download and Clear working), no per-row download control, no clipped last column, and a transfer panel that neither pads the page nor covers the scroll-to-top button. demi-api's job endpoint is mocked. Writes `/tmp/hdr-<width>-<state>.png` |

## Environment differences observed 2026-08-27

Run against `https://test.projects.eao.gov.bc.ca` with no credential: **1 passed, 60 failed,
1 skipped**. Every failure is the same cause - the site answers `401 Authorization Required`
(nginx basic auth) for `/`, every SPA route and `/demi-search`. The one pass is
`the comment period API is reachable and carries the project`, which only touches `/api/*`, the
one open path. Nothing behavioural could be compared; rerun with `BASIC_AUTH_USER` /
`BASIC_AUTH_PASS` set to get a real diff.

Config differences between the two environments (`/api/config`): test sets
`BANNER_COLOUR: orange`, `LOG_LEVEL: 0`, `ANALYTICS_DEBUG: true`, `ACCESS_GATE: true` and the test
Keycloak URL. `SEARCH_API_PATH` is `/demi-search` on both, and neither carries a `CONTENT_SEARCH`
flag.

## Tags

`@data` marks tests whose assertions depend on live data volume (result counts falling when a filter
is applied, a keyword returning hits). Deselect with `yarn playwright test --grep-invert @data`
(the `test` script does not pass arguments through).

## Files

| File | Tests | Covers |
|---|---|---|
| `tests/smoke.spec.ts` | 12 | every top-level route loads, posts `/analytics`, one `h1`, no `img` without `alt` |
| `tests/static-pages.spec.ts` | 12 | home, contact, legislation, compliance-oversight, process, search-help, news, project-notifications, cac-unsubscribe |
| `tests/projects-list.spec.ts` | 5 | table, sort, pagination, keyword filter, deep link |
| `tests/projects-map.spec.ts` | 6 | map and clusters, inline filters panel, filter, pin card, list-card card, basemap switch |
| `tests/search.spec.ts` | 6 | table, keyword, milestone facet, pagination, deep link, row links |
| `tests/project-detail.spec.ts` | 11 | tab strip and all 7 child routes, download link shape |
| `tests/comment-period.spec.ts` | 5 | `/p/../cp/../details`, `/pn/../cp/../details`, closed and open states |
| `tests/routing.spec.ts` | 6 | 404 fallback, `/p/:id`, `/p/../cp/:id`, `/pn/../cp/:id`, `/search/content`, header nav |
| `tests/gate.spec.ts` | 3 | the `ACCESS_GATE` curtain: wrong password, right password, focus and label |
| `tests/interactions.spec.ts` | 5 | every sortable column, page-size picker, map region filter, header tab order, Escape on the comment modal |
| `tests/css-scoping.spec.ts` | 7 | computed styles that a lost Angular view-encapsulation boundary broke in the port |
