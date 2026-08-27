# EPIC public site parity tests

Playwright suite that pins the behaviour of the live public EPIC site so the React rewrite can be
checked against it. The tests talk to a deployed environment over HTTPS. They do not build or serve
this repo, and nothing here imports application code.

## Run

```bash
cd e2e
yarn install                                                  # first time only
yarn test                                                     # prod (default)
BASE_URL=https://test.projects.eao.gov.bc.ca yarn test        # test environment
BASE_URL=http://localhost:4200 yarn test                      # the port under development
yarn test --grep-invert @data                                 # skip live-data-volume tests
yarn test tests/search.spec.ts                                # one file
yarn report                                                   # open the HTML report
```

`BASE_URL` defaults to `https://projects.eao.gov.bc.ca`. Browsers come from
`/root/.cache/ms-playwright`; no download step is needed.

The **test environment serves every HTML route and `/demi-search` behind HTTP basic auth**
(`WWW-Authenticate: Basic realm="Restricted Content"`); only `/api/*` is open. Supply the
credential to run there:

```bash
BASE_URL=https://test.projects.eao.gov.bc.ca \
BASIC_AUTH_USER=... BASIC_AUTH_PASS=... yarn test
```

Without it the whole suite fails on test with a 401 page. That is an environment gate, not a
behaviour difference.

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
| `#table-template-page-count-display` | every table page | "Showing 10 of 348 results" |
| `#tableTop` | home | recent activity table |
| `#map` | map page, project detail | Leaflet container |
| `#applist-list` | map page | project list panel |
| `#applicantInput` | map page | project-name filter box |
| `#Milestone` | search advanced filters | facet combobox wrapper |
| `#emailInput` | cac-unsubscribe | email field |

### Classes

| Hook | Where | Used for |
|---|---|---|
| `.projects-view.app-list-open` / `.app-list-closed` | map page | list panel state |
| `.overlay` | map page | the only control that toggles the list panel |
| `.app-card` (and `.app-card.active`) | map list panel | project cards and selection |
| `.app-list__options` | map list panel | "348 results on map" |
| `.client-name` | map project card | applicant value |
| `.leaflet-container`, `.leaflet-marker-icon`, `.marker-cluster`, `.leaflet-popup` | map | Leaflet DOM |
| `.popup-title`, `.popup-content .app-link` | map popup | project popup body |
| `.project-tabs .nav-tabs .nav-link` | project detail | tab strip |
| `.tab-content` | project detail | active tab body |
| `.download-icon` | search results | per-row download control |

### Attribute selectors that are already semantic

- `table[aria-label="table-template"]` - every paged table.
- `td[data-label="Name"]`, `td[data-label="Download"]` - column cells. The `data-label` values are
  the visible column names and drive the responsive layout, so they are behaviour, not styling.
- Column headers expose `aria-label="Column header <Name> sortable"`; sorting is driven through that
  role+name, not through a class.
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
- **The map list panel has no "open" control.** It starts closed and only the transparent
  `.overlay` (`aria-label="Close project list"`) toggles it, in both directions.
- **A map list card does not open the map popup.** It only marks the card `.active`. Only a marker
  click opens `.leaflet-popup`.
- **Map project cards carry no project name** - only applicant, purpose, disposition, EAO project
  number and status. Filtering is therefore asserted on the result counts.
- **`fields=[object Object]`** appears in the project detail document probes. Left in the baseline
  because it is what prod sends; fixing it is an API-contract change, not a port concern.
- **Project detail shows 3 fixed tabs** (Project Details, Commenting, Documents) plus
  Application / Certificate / Amendment(s) / Unsubscribe only when that project has the matching
  documents.

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

## Environment differences observed 2026-08-27

Run against `https://test.projects.eao.gov.bc.ca` with no credential: **1 passed, 60 failed,
1 skipped**. Every failure is the same cause - the site answers `401 Authorization Required`
(nginx basic auth) for `/`, every SPA route and `/demi-search`. The one pass is
`the comment period API is reachable and carries the project`, which only touches `/api/*`, the
one open path. Nothing behavioural could be compared; rerun with `BASIC_AUTH_USER` /
`BASIC_AUTH_PASS` set to get a real diff.

Config differences between the two environments (`/api/config`): test sets
`BANNER_COLOUR: orange`, `LOG_LEVEL: 0`, `ANALYTICS_DEBUG: true` and the test Keycloak URL.
`SEARCH_API_PATH` is `/demi-search` on both, and neither carries a `CONTENT_SEARCH` flag.

## Tags

`@data` marks tests whose assertions depend on live data volume (result counts falling when a filter
is applied, a keyword returning hits). Deselect with `yarn test --grep-invert @data`.

## Files

| File | Tests | Covers |
|---|---|---|
| `tests/smoke.spec.ts` | 12 | every top-level route loads, posts `/analytics`, one `h1`, no `img` without `alt` |
| `tests/static-pages.spec.ts` | 12 | home, contact, legislation, compliance-oversight, process, search-help, news, project-notifications, cac-unsubscribe |
| `tests/projects-list.spec.ts` | 5 | table, sort, pagination, keyword filter, deep link |
| `tests/projects-map.spec.ts` | 6 | map, clusters, list toggle, filter, marker popup, card selection |
| `tests/search.spec.ts` | 6 | table, keyword, milestone facet, pagination, deep link, row links |
| `tests/project-detail.spec.ts` | 10 | tab strip and all 7 child routes, download link shape |
| `tests/comment-period.spec.ts` | 5 | `/p/../cp/../details`, `/pn/../cp/../details`, closed and open states |
| `tests/routing.spec.ts` | 6 | 404 fallback, `/p/:id`, `/p/../cp/:id`, `/pn/../cp/:id`, `/search/content`, header nav |
