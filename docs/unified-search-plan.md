# Unified search page (PUBLIC-146)

One `/search` page and one display grid across four record types.

## Context

The `react` branch has four separate list destinations today: `/projects-list`,
`/search` (plus `/search/content`), `/news` and `/project-notifications`. All four
are thin wrappers around the old `TableList` and `TableTemplate` engine.

PUBLIC-146 replaces them with a single `/search` page: a 48px keyword field,
record-type pills with live match counts, a rebuilt dense display grid (sticky
header with an in-header filter row, multi-select value pickers, an advanced
filter panel, a chip row, a column picker and a copy-link button), a list row
template for text-heavy records, a document content scope with passages, a
search-help dialog and a seven step guided tour. About eight tickets depend on
this grid.

The design prototype lives under `design/handoffs/unified-search/` (local only,
not committed). It holds the ticket notes, `Display Grid - Rebuild.dc.html`,
`Search - Unified.dc.html`, `Project Page - Redesign.dc.html`, eight state
screenshots and the fonts and CSS the app already ships. The source archive is
kept outside the repo; `TODO.md` records where. The `design/` directory is
listed in the checkout's local exclude file, so it never enters a commit.

## Decisions (2026-09-12)

- Four tabs: Projects, Documents, Activities & updates, Project notifications.
- Tab counts must scale. One server call per typing pause, not four browser calls.
- Passage locators must become real, quotable PDF page numbers.
- The design prototype stays out of version control.

## Findings that shape the plan

Verified against the current code:

- The wire filter ids already exist. `eagle-demi/src/search/eagle-query.js:72-105`
  aliases `type` to `typeId`, `milestone` to `milestoneId`, `projectPhase` to
  `projectPhaseId`, `documentAuthorType` to `documentAuthorTypeId`, `eacDecision`
  to `eacDecisionId`, `currentPhaseName` to `currentPhaseNameId`,
  `CEAAInvolvement` to `ceaaInvolvementId` and `proponent` to `proponentId`.
  `region`, `legislation`, `isFeatured`, `pcp` and `decision` filter under their
  own names. `and[<field>Start]` and `and[<field>End]` date ranges are generic.
  A multi-value `and[k]=a,b` is an OR group (`eagle-query.js:338-344,382`).
- There is no counts endpoint and no facet use. Document totals are a two leg sum
  (`ai-search.js:1396-1540`), so a `top:0&count:true` shortcut under-reports
  Documents. `countMatching()` (`ai-search.js:923`) is the count primitive and is
  keyword-unaware. The notifications Cosmos `count()` takes no keywords
  (`repositories/notifications.js:85`).
- Index gaps. The `projects` index has no `dateUpdated` (Cosmos rows do, see
  `src/merge/project.js:65`; the datasource SELECT omits it) and no
  `legislation`. The `activities` datasource omits `documentUrl`. Each would land
  silently in `meta.dropped`.
- Page numbers are synthetic everywhere. `src/chunker.js:83,132` counts emitted
  blocks. `extractor/extract.py:113-119` and `extraction-host/worker.py:471-489`
  drop the pypdfium2 page index on the text path. The OCR path discards the
  docling document at `worker.py:553` and keeps only flat markdown. Nothing with
  page provenance is persisted, not Cosmos, not blob, not the host `sent/*.md`
  files. The wiki page `Extraction-Pipeline.md:157-164` records the limit. Real
  pages need an extractor change and a re-extraction run.
- Frontend parts to reuse: `table-params.ts` (pure URL helpers), `use-table.ts`
  (`keepPreviousData`, abort), `pagination.tsx`, `page-size-picker.tsx`,
  `use-page-selection.ts`, `state/bulk-download.ts`, `custom-multi-select.tsx`
  (typeahead), `filter-object.ts`, `subscribe-popover.tsx` (dialog pattern),
  `search-help.tsx` copy and `document-grid-row.tsx`. Debounce constants are in
  `search-filter-template.tsx:40-42`. `DataTable` has one consumer,
  `project-document-tab.tsx`. After retirement `TableList` keeps two consumers:
  `pages/comments/comments.tsx` and `project-notification-documents-table.tsx`.
- `site-header.tsx:8-12` points Search at `/projects-list` today.

## Tracker

The checklist for this work lives in `TODO.md` under "Unified search
(PUBLIC-146)". Phase 0 and Phase 7 are eagle-demi work and are tracked in
`eagle-demi/TODO.md` under the same heading. This document holds the detail
behind each item.

## Phase 0: counts endpoint and index gaps (eagle-demi, first)

Route `GET /search/counts?keywords=&prefix=&datasets=Project,Document,RecentActivity,ProjectNotification`
registered in `src/http/routes.js` next to `/search`, with the same guards
`[passiveAuthMiddleware, credentialsMiddleware]`. The response envelope matches
`/search`:

```json
[{ "counts": { "Project": 12, "Document": 340, "RecentActivity": 3, "ProjectNotification": null },
   "meta": [{ "unavailable": ["ProjectNotification"], "degraded": [], "cached": false }] }]
```

`null` means unknown, never 0. The UI hides the badge for it.

- `src/search/ai-search.js`: a new `countKeyword(index, opts)` returning
  `{ search: buildQuery terms, top: 0, count: true, filter: aclFilter, searchFields }`,
  with no highlight and no semantic ranking. Used for Project, RecentActivity and
  ProjectNotification. Document uses `searchDocuments({ top: 1, countOnly: true })`
  so the badge equals the toolbar total; `countOnly` skips the Cosmos row
  read-back.
- `src/controllers/search.js` gains `exports.counts`: `Promise.allSettled` per
  dataset, a rejected leg becomes `null` plus an entry in `meta.unavailable`.
  Kill-switch fallbacks: RecentActivity falls back to
  `updatesRepo.count(access, { keywords })`; ProjectNotification with the index
  off returns `null`.
- Cache: a module `Map` keyed
  `${normalizedKeywords}|${prefix}|${accessFingerprint}`, TTL 45 s, cap 200, with
  in-flight promise dedupe. Access belongs in the key because counts are ACL
  scoped.
- `eagle-query.js`: allow `datasets` for this handler only. An unknown param
  still returns 400.
- Index gaps, decided: add `c.dateUpdated` to
  `azure/search/datasources/demi-projects-ds.json` and `dateUpdated`
  (`Edm.DateTimeOffset`, filterable and sortable) to
  `azure/search/indexes/projects.json`. Add `c.documentUrl` to
  `demi-updates-ds.json` and a filterable `documentUrl` to `activities.json`, so
  "Documents attached" becomes `and[documentUrl]` non-empty. The Projects
  "Legislation" filter is cut because there is no index field for it; note that
  in `types/projects.ts`. The index PUT and the indexer reset on test are devbox
  steps through `with-search-admin.sh` (README section "Adding an index"), the
  same as the open activities and project-notifications index item in the
  workspace tracker.
- No facets. Option lists come from the `dataset=List` and `dataset=Organization`
  reads the app already caches.
- Update `src/swagger/swagger.yaml`. Extend the index guard test for
  `dateUpdated` and `documentUrl`.
- Tests `test/controllers/search.counts.test.js`: per-dataset delegation, cache
  hit, miss and TTL, in-flight dedupe, ACL isolation in the key, a rejected leg
  returning `null` rather than a 500, the notifications index off returning
  `null`, the activities index off falling back to the Cosmos count, and an
  unknown param returning 400.
- Verify on test: `counts.Document` equals `meta[0].searchResultsTotal` from
  `/search?dataset=Document&keywords=X&pageSize=1`.
- Document `/search/counts` on the `eagle-demi.wiki` search page.

## Phase 1: display grid components (eagle-public, inert)

A new `src/app/components/display-grid/` with no consumer yet. This is the
PUBLIC-146 deliverable. The old `TableTemplate` and `DataTable` stay untouched;
no component runs in dual mode.

Scope note from 2026-09-12: this is a major change, so new reusable components
are expected and reworking existing code is acceptable where it gets the result.
The reuse list below is a starting point, not a limit. If `table-params.ts`,
`use-table.ts`, `pagination.tsx`, `page-size-picker.tsx` or the bulk-download
store need signature changes to fit the grid, change them and update their
remaining consumers rather than wrapping them. What stays fixed: parity with the
design, server-side filtering, the `and[<id>]` wire contract, and no dual-mode
old components.

| File | Export |
|---|---|
| `display-grid.tsx` | `DisplayGrid({ caption, columns, rows, template: 'grid'\|'list', rowComponent, loading, emptyMessage, selectable, sort, filters, onSort, onFilterChange, page, pageSize, total, onPageChange, onPageSizeChange, headerless })` |
| `grid-header.tsx` | `<th>` sort buttons, `aria-sort`, a 2px inset accent on the sorted column, `--typography-color-link` ink |
| `filter-row.tsx` | second `<thead>` row of `<td>` cells, visually hidden "Filter by <col>" labels, sticky top measured from the header with `ResizeObserver` |
| `value-picker.tsx` | button reading "All", a value, or "N selected" (full list in `title`), a `position: fixed` checkbox list, flips above when there is less than 220px below, closes on outside pointerdown, Escape or scroll, Clear per column; long lists such as proponents delegate to `custom-multi-select.tsx` |
| `year-picker.tsx` | year dropdown for date columns |
| `chip-row.tsx` | "Narrowed by" chips, keyword chip and Clear all, ground `--theme-blue-10` |
| `advanced-filters.tsx` | `repeat(auto-fit, minmax(210px,1fr))`, 40px controls, `YYYY-MM-DD` text inputs with `inputMode="numeric"`, inline `role="alert"` error, an invalid date applies no filter and shows no chip |
| `grid-toolbar.tsx` | `role="status"` count, scope-switch slot, More filters (with badge), Columns picker (link column locked), Copy link ("Link copied" for 2 s), selection swap between Download N and Clear, `min-height: 56px` held |
| `list-row.tsx` | meta line, `<h3>` headline (a link only when `recordHasPage`), 3 line clamp, Show more and Show less over 260 characters, excerpt starting near the first hit, label and value pairs for grid records below 720px |
| `highlight.tsx` | text parts plus `<mark>`, never injected HTML; declares `--theme-gold-40` ground and `--typography-color-primary` ink |
| `use-grid-url-state.ts` | one hook over `useSearchParams` reusing `table-params.ts`; a sort, filter or page-size change resets to page 1; a record switch keeps the keyword and clears filters, sort, scope, selection and hidden columns |
| `display-grid.css` | everything scoped under `.display-grid`; no bare `body`, `a`, `label` or `input` selectors |

Reuse: `pagination.tsx`, `page-size-picker.tsx` (options 10/25/50/100, default
25), `use-page-selection.ts`, `use-table-handlers.ts`, `state/bulk-download.ts`,
`use-table.ts`, `filter-object.ts`, `custom-multi-select.tsx`.

CSS points to encode and then assert in `e2e/tests/css-scoping.spec.ts`:

- `label { display: block }` inside the grid, because the Bootstrap reboot
  shrink-wraps the search field otherwise.
- An explicit `height` on inputs, which beats the bare `input[type=text]` rule in
  `epic/styles.css`.
- `min-width: 880px` on the table, with horizontal scroll below that.
- Breakpoints at 720 (list rows) and 900 (narrow).
- One z-index scale in a single custom property block: picker 60, sticky head 10,
  columns 30, dialog and tour 2000 to 2002. The masthead is 1005.
- Page-top scrolling targets `body`, which is the scrolling box, not `html`.

Sorting: `Intl.Collator(undefined, { numeric: true })` for client-side
comparisons only. Server sort stays `sortBy=±field`. Dates default to `-`.

Tests, Vitest beside the files: `display-grid.spec.tsx` (sticky offset recompute,
loading dim keeps the old rows, headerless moves column filters into the panel),
`filter-row.spec.tsx`, `value-picker.spec.tsx` (flip, Escape, outside press,
scroll close, "2 selected"), `advanced-filters.spec.tsx` (an invalid date emits
nothing and shows the error), `chip-row.spec.tsx`, `highlight.spec.tsx` (a
hostile term never renders as HTML) and `use-grid-url-state.spec.ts`. Verify
`yarn test`, `yarn build` and `yarn lint`. No route change in this phase.

## Phase 2: `/search` unified page, Projects and Documents

New `src/app/pages/search/unified-search.tsx` and `.css`, `use-type-counts.ts`,
and `types/{index,projects,documents}.ts`.

Per-type config shape:

```
{ id, label, dataset, defaultSort, template, columns, filterIds, advancedFields,
  optionsFrom(lists, orgs), recordHasPage, selectable, rowComponent, headerless }
```

- `projects.ts`: dataset `Project`, default sort `-dateUpdated` (falls back to
  `+name` until the Phase 0 index lands, detected through `meta.dropped`),
  columns Project (link, locked), Last updated, Proponent, Type, Region, Phase;
  filters `proponent`, `type`, `region`, `currentPhaseName`; advanced
  `dateUpdatedStart` and `dateUpdatedEnd`, `eacDecision`, `CEAAInvolvement`.
- `documents.ts`: dataset `Document`, default sort `-datePosted`, columns Name
  (link), Date posted, Document type, Milestone, Project phase, Author; filters
  `type`, `milestone`, `projectPhase`, `documentAuthorType`; advanced
  `datePostedStart` and `datePostedEnd`, `legislation`, `isFeatured`;
  `selectable: bulkDownloadEnabled()`.

URL schema. It keeps the existing param names, so the redirects are close to
identity and `table-params.ts` is reused as is: `keywords`, `record`
(`projects|documents|activities|notifications`, default `projects`), `scope`
(`names|inside`, documents only), `sortBy`, `currentPage`, `pageSize`, `cols`
(hidden columns as a comma list), plus one param per wire filter id. The param is
`record` rather than `type` because `type` is a filter id on three datasets.

Counts. `useTypeCounts(keywords)` is a `useQuery(['search-counts', keywords])`
with `keepPreviousData` and an abort signal, driven by the same 300 ms debounce
and two character floor as the main query (`TYPEAHEAD_DEBOUNCE_MS`,
`MIN_TYPEAHEAD_LENGTH`). On a 404 from `/search/counts` it memoizes
`countsUnsupported` and falls back to four parallel `fetchData(pageSize: 1)`
reads of `searchResultsTotal`, so this work can ship before Phase 0 is deployed.
A `null` count renders a pill without a badge. Analytics is unchanged: one event
per typing pause, aborts not logged.

Routing. `/search` renders `UnifiedSearch`. The old `pages/search/search.tsx`,
`search.config.ts` and `search-documents-table-rows.tsx` are deleted in the same
change. `/projects-list` gets a `redirect` loader to `/search?record=projects`
preserving `keywords`, `currentPage`, `pageSize`, `sortBy` and the filter params.

Tests: `unified-search.spec.tsx` (a tab switch keeps the keyword and clears
filters and sort, badges render, a filter change resets the page, copy link
writes the current URL and the label flips back after 2 s),
`use-type-counts.spec.ts` (404 fallback, abort), and `types/projects.spec.ts`
plus `types/documents.spec.ts` (every `filterIds` entry appears as
`and[<id>]=` in the issued URL). End to end: rewrite `e2e/tests/search.spec.ts`
and `projects-list.spec.ts` against `/search`, and add the redirect assertion to
`routing.spec.ts`. Check in a browser that there is one `/search` request per
pause per type and that `meta[0].dropped` is empty for every advertised filter.

## Legacy URLs must land in the new search

Bookmarks, emails, gov.bc.ca links and search engine results carry the old URLs.
Every one must resolve to `/search` with the intent preserved. The inventory is
verified against `origin/develop` and `react`.

| Legacy path | Params carried | New target |
|---|---|---|
| `/projects-list` | `keywords, currentPage, pageSize, sortBy` plus `type, eacDecision, proponent, region, CEAAInvolvement, currentPhaseName, decisionDateStart, decisionDateEnd` (`project-list.constants.ts:47-48`) | `/search?record=projects&…` |
| `/search` (Angular meaning: documents) | `keywords, currentPage, pageSize, sortBy, dataset` plus `milestone, documentAuthorType, type, projectPhase, datePostedStart, datePostedEnd` (`search.config.ts:90-92`) | `/search?record=documents&…`, or the default projects tab when no document param is present |
| `/search/content` (React only) | same as documents | `/search?record=documents&scope=inside&…` |
| `/news` | `keywords, currentPage, pageSize, sortBy` | `/search?record=activities&…` |
| `/project-notifications` | `keywords, currentPage, pageSize, sortBy` plus `type, region, pcp, decision` (`project-notifications.config.ts:20`) | `/search?record=notifications&…` |
| `/search-help` | none | stays, the dialog links to it |
| `/#/projects-list` and friends (old hash router) | as above | strip the `#/` and re-enter the map |

Implementation, one module `src/app/routes/legacy-search.ts`:

- `legacySearchRedirect(record)` is a react-router loader. It reads
  `request.url`, builds the new query with `toSearchParams` and returns
  `redirect(...)`. The 301 semantics are client side, which is fine for a single
  page app, and the edge already serves `index.html` for every path.
- A param mapping table keyed by record. Names that match pass through
  (`keywords`, `currentPage`, `pageSize`, `sortBy`, and every filter id above,
  which already matches a DEMI wire id or an alias in `eagle-query.js:72-105`).
  `dataset` is dropped. `decisionDateStart` and `decisionDateEnd` are kept as
  projects advanced fields; confirm the index carries `decisionDate`, and if
  `meta.dropped` names it, map it to nothing and note that.
  `sortBy` values are validated against the record's sortable columns and fall
  back to the default.
- Ambiguous bare `/search`: if `record` is absent and any of `milestone`,
  `documentAuthorType`, `projectPhase`, `datePostedStart`, `datePostedEnd` or
  `dataset=Document` is present, go to documents. Otherwise go to projects, the
  default tab.
- Hash router: a guard in `app-shell.tsx` or the root loader. A `location.hash`
  starting with `#/` becomes `navigate(hash.slice(1), { replace: true })`, then
  the path loaders take over.
- The project page and document redirects already in `routes.tsx:90-99` stay. The
  nginx rewrites in `eao-nginx/conf.d/server.conf.tmpl:470-557` are API side and
  are untouched.
- Tests: `legacy-search.spec.ts`, table driven, one row per legacy URL above,
  including a full Angular projects-list URL with every filter and a hash URL.
  End to end `routing.spec.ts` navigates each legacy URL and asserts the final
  URL, the active tab and the keyword in the field. The parity suite is
  unaffected.
- Docs: a "URLs" section in `docs/deviations-from-angular.md` carrying the table,
  and the routes table on the eagle-public wiki page.

## Phase 3: Activities & updates and Project notifications tabs

- `types/activities.ts`: dataset `RecentActivity`, default sort `-dateAdded`,
  `template: 'list'`, `recordHasPage: false`; columns Update, Posted, Kind
  (`type`), Project (`projectId`, link); advanced `dateAddedStart` and
  `dateAddedEnd`, Kind, and Documents attached (`documentUrl`, gated on the Phase
  0 index). An attachment renders as a download link with the file name taken
  from the URL. File size is not available, so it is omitted.
- `types/notifications.ts`: dataset `ProjectNotification`, default sort as in
  today's `project-notifications.config.ts`, `headerless: true` so the column
  filters live in the panel; filters `type`, `region`, `pcp`, `decision` from
  `Constants`; the row body is lifted from
  `project-notifications-table-rows.tsx`. `project-notification-documents-table.tsx`
  is a detail table and stays as it is.
- Redirects: `/news` to `/search?record=activities` and `/project-notifications`
  to `/search?record=notifications`, params preserved. Home page links move to
  the new URLs.
- Tests: `types/activities.spec.ts`, `types/notifications.spec.ts`, list row
  clamp and expand, e2e `routing.spec.ts` and `smoke.spec.ts`. Port the
  assertions from `news.spec.tsx` and `project-notifications.spec.tsx` before
  deleting them.

## Phase 4: inside documents scope

A segmented control in the toolbar, documents tab only. `scope=inside` switches
the dataset to `DocumentChunk` with `prefix=false`, and sort gains "Most
matches", which is the default in this scope. Leaving the scope restores
`-datePosted`.

New `display-grid/passage-list.tsx`: the file name as a link with `<Highlight>`,
a meta line of `date · type · author`, "N matching passage(s)", and each passage
with its locator on a quiet left rule. Two passages show, then "N more passages"
and "Show fewer passages". The locator label comes from one constant,
`PASSAGE_LOCATOR`. It reads "Passage N" until a row carries `pageNumbered: true`
(Phase 7), after which it reads "Page N" and the file link gains `#page=N`.

No keyword state: the prompt "Search inside the documents" with body copy, a
count reading "N documents indexed", and no pager. Empty states cross-link the
scopes using the counts already in hand ("See N matches inside the documents",
"See N match(es) in names & details").

This retires `pages/search/content-search.tsx` and `content-result.tsx` (the
`dangerouslySetInnerHTML` at lines 14 and 79 goes away), their CSS and specs, and
`contentSearchLoader`. `contentSearchEnabled()` stays as the gate on the scope
switch. Tests: `passage-list.spec.tsx` (expand and collapse, hostile text
escaped), a scope switch spec (sort swap and restore), and e2e in
`search.spec.ts`.

## Phase 5: search help dialog and guided tour

`display-grid/search-help-dialog.tsx`: a native `<dialog>` opened with
`showModal()`, which gives the focus trap, Escape handling and `aria-modal` for
free. Backdrop click closes it, `body` scroll is locked while open, and focus
returns to the opener. The Quotes and Hyphens copy comes from
`pages/search-help.tsx`; that page stays and the dialog links to it for the
folder structure lists. The dialog offers "Take the tour".

`display-grid/guided-tour.tsx` and `tour-steps.ts`: seven steps targeted by
`data-tour` attributes (search, types, scope, filterrow, more, columns, copy). A
gold ring `--theme-gold-90` at 3px, four dim panels, and a card reading "Step N
of M" with Back, Next and Skip tour. Absent targets are skipped and M is
recomputed. An off-screen target is scrolled into view before it is measured, a
resize re-measures, the z-index sits above 1005, and `body` scroll is locked.

Tests: focus trap and restore, Escape and backdrop, scroll lock release, absent
target skip, and an end to end keyboard walk.

## Phase 6: header nav and retirement

- `site-header.tsx` Search points at `/search`.
- Delete `pages/project-list/*`, `pages/news*`,
  `pages/project-notifications/project-notifications.tsx` and its `.config.ts`
  and specs. Keep `project-notification-documents-table*`.
- Migrate `pages/project/project-document-tab.tsx` from `DataTable` to
  `DisplayGrid`, move `SelectCell` into `display-grid`, and delete
  `components/data-table/*`.
- `TableList` and `TableTemplate` stay for `comments.tsx` and
  `project-notification-documents-table.tsx`. Only the four retired configs are
  deleted. Add a tracker line to migrate those two later.
- `e2e/tests/routing.spec.ts` covers every old path. Rules for deleted pages come
  out of `css-scoping.spec.ts`.
- `docs/deviations-from-angular.md` records the four into one change and the
  redirects. Update the routes table on the eagle-public wiki page.

## Phase 7: real PDF page numbers (eagle-demi, parallel track)

The goal is a "Page 12" a reader can quote, and a file link that opens the PDF at
that page.

1. The extractor emits page boundaries. Text path
   (`extractor/extract.py:113-119`, `extraction-host/worker.py:471-489`): keep
   the per-page list and join it with a form feed `\f` marker per page. OCR path
   (`worker.py:553`): iterate the docling document per page
   (`export_to_markdown(page_no=...)`, or `iterate_items()` with
   `prov[].page_no`; check against the installed docling version) and join with
   the same `\f`. The wire format is unchanged, still one markdown string, so
   `ingest.py` and the two ingest doors need no change.
2. `src/chunker.js` splits input on `\f`. `pageNumber` becomes the real 1-based
   page for the block, and a block never spans a marker. The chunk id
   `<docId>::p<page>::c<index>` keeps its shape. The document record gets
   `pageNumbered: true` and `pageCount` on ingest when markers were present.
   Chunks are stamped `pageNumbered: true` and the `chunks` index gains that
   filterable boolean.
3. `group-chunks.js:78` and the `search.js` DocumentChunk mapping expose
   `pageNumbered`, and the "not a PDF page" caveat is dropped when it is true.
   Update the "Known limits" section of the wiki `Extraction-Pipeline.md`.
4. Re-extraction. Text layer documents, about 70% of 60,391, re-run on CPU
   without docling and are fast. Scanned documents, about 30%, re-run on the
   dedicated extraction host; the previous full pass took about six days. Ingest
   replaces a document's chunks atomically per document, so search stays
   consistent during the run: the UI shows "Passage N" for documents not yet
   redone and "Page N" for the rest. No host address or worker script goes into
   the repo; that is backfill-only tooling.
5. eagle-public `passage-list.tsx`, already prepared in Phase 4: when
   `pageNumbered` is set, the label reads "Page N" and the link becomes
   `documents/<id>/download#page=N`. Browser PDF viewers honour `#page=`; verify
   on test that the presigned redirect keeps the fragment.

## Parity gate

The built page must match the design prototype. The work loops until it does. The
judge is never the builder.

`e2e/parity/README.md` is the operator's copy of this: it gives the exact commands,
`yarn parity:reference` to recapture the reference screenshots from the prototype and
`yarn test:parity` to hold the built page against them. It also says where the
references live, `e2e/parity/unified-search/reference/<state>-<width>.png`, and when
recapturing is the right move rather than a gate failing silently.

The reference set is built once in Phase 1 and committed under
`e2e/parity/unified-search/`:

1. Sample data. Lift the prototype's `DATASETS` and `CONTENTS` arrays (12
   projects, 18 documents, 10 activities, passage hits) out of
   `Display Grid - Rebuild.dc.html` into `e2e/fixtures/unified-search/*.json`.
   Project notifications get a hand-made 8 row fixture in the same style, because
   no mockup exists for that tab.
2. Reference renders. Playwright opens
   `design/handoffs/unified-search/Search - Unified.dc.html` over `file://` (its
   `support.js` runtime works in a browser, see the prototype README), drives it
   into each of the eight prototype states plus tour steps 2 to 7, phone width,
   the selected state and the empty state, and saves PNGs at 924px and 400px. The
   eight shipped screenshots are kept as a second reference. The script is
   `e2e/parity/capture-reference.ts` and it is run on demand only, so the design
   prototype never has to be present in CI.
3. App renders. Playwright route interception
   (`page.route('**/demi-search/**')`) serves the fixtures, so the app shows the
   same records, counts and passages as the prototype. Same states, same
   viewports, same script order.
4. Compare. `expect(page).toHaveScreenshot(name, { maxDiffPixelRatio: 0.005 })`
   against the reference PNGs, plus a per-state measurement assertion list:
   search field 48px, filter controls 30px, panel controls 40px, bar 56px, table
   min-width 880px, sorted accent 2px, chip row ground `--theme-blue-10`,
   highlight `--theme-gold-40`, ring `--theme-gold-90` at 3px, z-index above
   1005. The measurements catch what a pixel diff cannot explain.
5. Fonts. BC Sans comes from the app's own `@bcgov/bc-sans` and from the
   prototype's `epic/fonts/BCSans.css`. They are the same files, so text renders
   alike. Material Icons likewise.

The loop for each of Phases 2 to 5, fixed before the first round:

- The implementer builds or fixes the screen against the prototype HTML and CSS.
  Visual work is not treated as ordinary logic work.
- The judge is `yarn test:parity` (the Playwright suite above) plus, for every
  failing state, a visual review that reads reference and actual side by side and
  returns a written diff list: what is off, by how much, on which element. The
  builder never edits the reference PNGs, the fixtures, the threshold or the
  measurement list.
- Cap: 3 rounds per phase. Round 1 fixes everything on the list. Rounds 2 and 3
  fix what remains. If it has not converged after round 3, stop and report the
  residual diffs with screenshots. Do not raise the threshold and do not push.
  The next step is a decision to accept, redesign or continue.
- Exit condition per phase: every parity state passes at both viewports, the
  measurement assertions are green, and an accessibility review finds no contrast
  or focus regression against the prototype token table. Only then does the change
  go up for review.
- Regression guard: `test:parity` runs in the PR Checks `e2e` job from Phase 2
  on, so later phases cannot drift earlier screens.

Known non-parity by decision, documented here and not treated as failures:
sample data is replaced by fixtures; "Page N" reads "Passage N" until Phase 7;
the activities attachment size is omitted; the Projects Legislation filter is
absent; the Project notifications tab is designed in code following the same grid
tokens.

## Loops and stop conditions

No loop in this work runs without a cap and an exit condition written first. A
cap reached without convergence means the problem is not understood: stop and
report the residual list. Never raise a cap or a threshold mid-loop.

| Loop | Exit condition | Cap | On cap |
|---|---|---|---|
| Parity loop per phase | every parity state passes at 924 and 400, measurement assertions green | 3 rounds | stop, report screenshots and diff list, no push |
| Review fix loop after a review | the review returns no finding that breaks the ask or loses data | 2 rounds, round 2 fixes only those, the rest go to `TODO.md` | stop, list the carried findings on the PR |
| Test fix loop (a red spec after a change) | `yarn test` green | 3 attempts per spec | stop, mark the item `(in progress)` with the failing spec name |
| Counts endpoint retry (server side, `ai-search.js`) | 2xx from the search service | `MAX_ATTEMPTS=3`, `Retry-After` backoff | the leg returns `null` and lands in `meta.unavailable` |
| Counts feature detect on the client | `/search/counts` answers 2xx once | 1 probe | fall back to four `pageSize=1` reads |
| Re-extraction run (7.5) | every document in the corpus list is either re-ingested with `pageNumbered: true` or in the error list | one pass over the list, 2 attempts per document | stop, report the error list, no third attempt without a decision |
| Indexer wait after a PUT (0.6, 7.4) | indexer status `success` | `timeout 1800` on the poll script | stop, report the indexer status |
| Tracker pickup | all checklist items ticked | one item at a time, never re-open a ticked item | n/a |

## Order and release

Phase 0 (eagle-demi) and Phase 1 (the inert grid) run in parallel. Then Phases 2,
3, 4, 5 and 6 each go up as a PR off `react`, each tagged `v3.0.0-beta.N` and
published to the next site with `-f target=next`. Phase 7 runs beside Phases 2 to
6; its UI hook is a one line label switch. Merges happen only when the maintainer
says so.

## Verification

- Unit: `yarn test`, `yarn lint` and `yarn build` green per PR.
- Browser, on `http://localhost:4200/search`: each of the eight prototype
  screenshots reproduced at 924px; the keyword "sediment" shows a count on each
  pill; the documents scope switch swaps the row template and the sort; the
  picker flips near the bottom of the viewport; the tour skips the scope step on
  the projects tab; below 720px every type renders list rows; old URLs redirect
  with their params intact.
- Network: one `/search` and one `/search/counts` per typing pause;
  `meta[0].dropped` empty for every advertised filter.
- Accessibility: a review pass on the page before Phase 6 merges, covering the
  dialog, the tour, `aria-sort`, the filter labels and the highlight contrast
  (10.92:1).
- After each beta: smoke the four tabs on the next site against test DEMI.
