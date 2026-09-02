# React migration (branch `react`)

Angular source of truth for behaviour: `/root/repos/eagle-public` (branch `develop`, read-only). This worktree holds the React rewrite. Old Angular `src/` is removed on this branch once phase 1 lands; read the original from the develop checkout.

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
- [x] 4. Parity pass, a11y, delete leftovers, README/CLAUDE.md update.
  - [x] 4a. Phase-3 findings (project card fields, `fields=[object Object]`, CAC location), dependency audit, leftovers, a11y basics, docs.
    - [x] `models/project.ts` fields that no payload carries.
    - [x] `&fields=` dropped from the search request.
    - [x] CAC `caclocationInput` — investigated, see Follow-ups.
    - [x] Dependency audit; `bootstrap.bundle.min.js` no longer shipped.
    - [x] Leftovers deleted (`assets/styles/layout/`, retina marker icons, dead badge CSS).
    - [x] a11y: skip link, `aria-live` toast container, popup CTA is a real `<button>`.
    - [x] `README.md` / `CLAUDE.md` describe the React stack.
  - [x] 4b. Parity run against prod (`e2e/` against `https://projects.eao.gov.bc.ca` data, 2026-08-27).
    - [x] Dev proxy follows `API_LOCATION` from the environment, `/demi-search` included, so a run can point at prod without prod URLs in `src/env.js`.
    - [x] Playwright suite green; the two request-baseline diffs (`&fields=`, pins `sortBy`) are Deviations, applied in `e2e/support/helpers.ts`.
    - [x] CSS scoping regressions fixed: `header.css`, `home.css`, the popup `hr` and the table pagination rules leaked or lost to Bootstrap once view encapsulation went away.
    - [x] Map opening view matches prod again (fit padding), and the map page footer is prod's.

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
- pages/search: `search.component.css` dropped. Every selector in it was dead under Angular's view encapsulation (the template is a single `<app-table-list>`), the `::ng-deep` hero-banner background included — prod renders the default banner on /search, so the port does too.
- pages/search: `search-document-table-rows.component.css` keeps `.download-icon` only; `.download-icon-wrap` matched nothing in the template.
- pages/search: the download icon gets `role="button"`. It was already a focusable span with a keyup handler and an aria-label, so screen readers announced it as plain text.
- pages/search: `LEGISLATION_FILTER_GROUP.labelPrefix`/`labelPostfix` are kept on the group object but unread — Angular's multi-select only ever passed `group.name` as the groupBy key.
- pages/content-search: an empty result set now clears the list and shows "No documents contain that text". Angular's table-service subscriber returned early on an empty payload (`res.data === 0`), leaving the previous search's cards on screen under the new keyword.
- pages/content-search: a keyword search keeps the current `pageSize`, matching the table-list fix above. Angular rebuilt the params without it.
- pages/content-search: snippets are escaped and re-opened for `<mark>` only before `dangerouslySetInnerHTML`. eagle-search already escapes them, but Angular's `[innerHTML]` ran the DomSanitizer over the result and React's has no equivalent, so that guard is restored in three lines rather than dropped.
- pages/project: the document-type tabs (Application, Certificate, Amendment(s)) are sub-tabs of Documents, joined by a new C&E Documents sub-tab, so their pageSize=1 presence probes fire on the Documents tab instead of on every project page. The request baseline drops those probe lines; `documents-page.spec.tsx` covers them instead. Old top-level paths redirect to the sub-tab, query string intact.
- state/map-ui: ConfigService's `mapBounds` getter dropped; nothing in the app ever read it.
- state/map-ui: `storage.service` dropped. Its background preload was never called from anywhere, and TanStack Query's cache already gives "fetch the project list once, reuse it on the way back".
- pages/projects: the `no-scroll` body class handling is gone; the app only ever removed that class, never added it.
- pages/projects: a failed project load leaves the page showing "No projects found" instead of redirecting to the home page. `api/project` already degrades a failed search to an empty list, so the redirect only hid the failure.
- pages/projects: filters are no longer cleared when leaving the page — the URL holds them, so navigating away drops them anyway. Angular's `clearAll()` on destroy also skipped the URL, leaving a stale query string behind.
- pages/projects: filter state lives only in the URL, so the filter bar has no second copy to fall out of step with it.
- projects/projlist-filters: `clearAllFilters` dropped; no template called it, and it cleared the filter signals without updating the URL.
- projects/project-filter: the type filter resolves the dropdown's camelCase code (`energyElectricity`) to its display name before comparing with `project.type` (`Energy-Electricity`). Comparing the code directly never matched, so Project Type filtered nothing. URL values are unchanged.
- projects/proj-detail-popup: the comment period status reads `response.data[0]`. Angular tested `.length` on the `{ totalCount, data }` wrapper, so the "Comment Period Status" row never rendered.
- projects/proj-detail-popup: the card shows the project description, clamped to four lines behind a More/Less toggle, plus phase, comment-period state, proponent/type meta line, region, EA decision and location.
- projects/projlist-list: the card is a button that selects the project, and the per-card arrow link is gone. "View project" in the popup navigates to `/p/:id`. Angular linked `/a/:id`, which matches no route and fell through to the home-page redirect.
- projects/projlist-map: the selected project renders in a card fixed to the map's bottom-left corner instead of a pin-anchored `<Popup>`, so it never covers its own pin; the scale bar and attribution moved to the bottom-right with the zoom controls to keep that corner clear.
- projects/projlist-list: on a phone the selected project expands in place under its list card, as an accordion body with no title or close button of its own; the map card is desktop only. Selecting from a pin raises the sheet to half, scrolls the card to the top of the list and moves focus to it.
- map: pins and clusters scale on hover, the pin label fades in and the project card slides in; every transition sits behind `prefers-reduced-motion: no-preference`. Angular's markers had no motion.
- projects/projlist-map: the popup never opens by itself. Angular opened one when exactly one marker was in view, which needed per-marker visibility tracking in a store and 80 lines of timers; selection is now always a click, on a pin or a card.
- projects/projlist-map: clicking a card flies the map to that project and opens its card. Angular only marked the card active.
- projects/projlist-map: EAO region polygons draw under the pins, follow the Region filter and toggle from the Layers menu. Filtering by region also frames the whole selected regions rather than the projects inside them, and the refit eases instead of jumping. New here; the Angular map has no overlay layers.
- projects/projlist-list: selecting a project the list has not paged to reveals its page, so the pin and the list card always agree. Angular's list had no paging tie to the map.
- projects/projlist-map: the map, the pins and the clusters are JSX. MapLibre clusters the GeoJSON source itself and sizes its own canvas, so the marker layer, the cluster plugin, the `invalidateSize` calls and the container polling are all gone.
- projects: the list panel is a persistent split view, always open on desktop. Angular slid a drawer over the map with no open control but a transparent overlay. With no open/close control the `Projects View Changed` event has no trigger left and is gone.
- projects/projlist-filters: the advanced filters expand inline under the filter bar, pushing the list down, and start closed with a badge on the Filters button carrying the active filter count. Angular rendered a "Show/Hide Advanced Filters" block that opened itself whenever the URL carried a filter.
- map: the attribution control renders on both maps. Angular passed `attributionControl: false`, which hides the attribution the Esri tile terms require.
- projects/projlist-map, projlist-list: the `name` attribute on the map and list `div`s became `aria-label`; `name` is not valid on a `div`.
- projects/projects.css: `.toggle-app-list-btn` rules dropped; no template renders that button.
- projects/projlist-filters: the search box keeps its raw text locally and writes the trimmed value to the URL, so a space typed between words survives.
- pages/project: `documents/detail/`, `cac/become-a-member`, `toggle-button/` dropped. No route or template in the Angular app reaches any of them.
- pages/project: the `project-unsubscribe` tab dropped. `initTabLinks` skipped it and its `display` started false, so it could never render.
- pages/project: `project.ts`'s `legislationLink`, `period` and `commentPeriod` signals dropped; nothing read them (the sidebar computes its own legislation link).
- pages/project: the shell shares the loaded project and the `List` items with its tabs through the router outlet context. Angular pushed them into `StorageService` and each tab re-read them; `commenting-tab` and `documents` also refetched the lists per row.
- pages/project: the scroll-position save/restore between `pins`/`project-activites` and `project-details-tab` dropped. It existed because the Angular router scrolled on every query-param navigation; react-router's `setSearchParams` does not move the page.
- pages/project/details-sidebar: the mini-map is a `<Map>` that renders once the project has a centroid. Angular polled `getElementById` every 100 ms until the element appeared, then `fixMap` polled `offsetParent` every 50 ms and re-centred twice more on a timer.
- pages/project/details-sidebar: the `featureGroup`, `fitBounds` and `defaultBounds` dropped. The map only renders when the project has a centroid, so fitting the bounds of that single marker at `maxZoom: 8` was the opening view the code already set.
- pages/project/details-sidebar: the Ocean basemap is dropped. The mini-map offers the same three basemaps as the project map, from the shared `app/map/basemaps.tsx`.
- config: the chosen base map layer moved from Angular's `ConfigService` to the `baseLayerName` store in `state/map-ui.ts`; it is session state, not env config.
- pages/project: the tab overflow arrows are JSX driven by a `ResizeObserver`, not `document.createElement` appended once per shell mount with a 100 ms retry loop and re-checks on every `NavigationEnd`.
- pages/project: one `ProjectDocumentTab` serves the Documents, Application, Certificate and Amendment tabs. The four Angular components differed only in which documents they select, whether they offer filters, and their empty message.
- pages/project: the document tabs return to page 1 when a column is sorted. Angular's Documents tab kept the page, showing a slice of the old ordering; its three siblings already reset.
- pages/project: a keyword search on a document tab keeps the current sort when the keyword itself did not change, and keeps the chosen page size. Angular reset both to `-datePosted` and dropped the page size.
- pages/project: sorting a column the table was not already sorted by starts ascending on all four document tabs. Angular's Documents tab flipped the sign of whatever the current sort was, and its three siblings always started descending, so on test the same click sorts Documents ascending and Certificates descending.
- pages/project: `/p/:projId/decisions` resolves and renders the shell with an empty tab. The route exists on `develop` but not in the build deployed to test, where the URL falls through to the map page.
- pages/project: `onResetControls` dropped from all four document tabs. `search-filter-template` already emits an empty search package on reset, which clears the keyword, every filter and the sort in one navigation.
- api/project: `getExtraAppData` and `getPeopleObjs` dropped with the two `dataset=Item&_schemaName=User` lookups they made. Nothing in either app reads `responsibleEPDObj`/`projectLeadObj`, and `getById` awaited them, so every project page held its own render for two dead requests. The two model fields went with them.
- pages/project: the sidebar hero, the project details block, Featured Documents and Participating Indigenous Nations each render a spinner while their own fetch is in flight. Angular's markup for the last two used `spinner-new`/`spinner-container`, classes no stylesheet defines, so the spinner was invisible and the sections just popped in.
- pages/project: `showFeatured` is passed to the rows through `tableData.data` instead of being written onto each record of the API response, which mutated the query cache.
- pages/project/pins: the table reads `/api/project/:id/pin` through a TanStack query. `api/pins.ts` — a module-scoped store with its own `fetchDataConfig` mirror of the table state — is deleted; nothing imported it.
- pages/project: the unstyled `spinner-container`/`spinner-new rotating` markup in `featured-documents` and `pins` dropped. Neither class is defined anywhere in the app, so it rendered as bare divs; `TableTemplate` already shows a spinner while loading.
- pages/project: `decisions-tab` renders nothing. Its Angular template was entirely commented out; the route is kept so `/p/:projId/decisions` still resolves.
- pages/project: `project-details-tab-{sm,md-lg}.component.css`, `application.component.css`, `project-activites.component.css` and `decisions-tab.component.css` not ported. No template in those components carries the selectors they define.
- pages/project: `services/storage.service.ts` (project preload cache) and `services/project-filter.service.ts` are left for phase 3b. Only `projects.component` — the map page — uses what remains of either.
- pages/comments: NgbModal replaced by a native `<dialog>`; `showModal()` supplies the focus trap and Escape, and the static backdrop still refuses to dismiss on a backdrop click. Dismiss reasons are readable strings, not ng-bootstrap's enum ordinals.
- pages/comments: the "Comment Modal Dismissed" event reports the page the modal was actually on. Angular read `currentPage` at open time, so it always reported 1.
- pages/comments: the hero spinner clears once both lookups settle. Angular blocked on a non-null project, so a project that failed to load spun forever.
- pages/comments: instructions and `commentTip` render through `utils/safe-html`. Angular used `bypassSecurityTrustHtml` and a raw `[innerHTML]`.
- pages/comments: row CSS is scoped to the `.comments` container instead of a host class, so its bare `.mt-2` rule cannot reach Bootstrap's utility class elsewhere on the page.
- pages/comments/add-comment: `commentFiles` dropped. It mirrored `documents` and was emptied on every change, so `maxFiles` only ever counted the current selection; attached files now count against the cap.
- pages/comments/add-comment: `progressValue` / `progressBufferValue` dropped; nothing has rendered them since the Material progress bar was removed. `totalSize` stays, it gates the "Submitting your comment..." panel.
- pages/comments/add-comment: the submission size is measured after the comment fields are filled in. Angular measured the still-empty comment, so a long comment with no attachments never showed the panel.
- pages/comments/add-comment: `documentAuthorType` is omitted from the upload when the `List` lookup yields none. Angular sent the string "undefined". `documentSource` is appended once, not twice.
- components/file-upload: `showInfo` input dropped; no template read it. Dead CSS dropped (`.form-text`, `.file-upload*`, `.doc-list`) — those classes are absent from the template, and `.doc-list` is styled globally by comments.css.
- components/file-upload: drag handlers sit on the drop area rather than a component host, and the browse link is `href="#"` with `preventDefault` in place of `javascript:void(0)`. One 5-second timer clears the error list; Angular started one per invalid file.
- pages/cac-unsubscribe: the emailed matrix-parameter link (`/cac-unsubscribe;project=…;email=…`) gets its own route, because react-router reads that as one path segment. Query-string parameters are accepted too.
- pages/cac-unsubscribe: buttons are `type="button"`; Angular relied on NgForm to swallow the implicit form submit. `cac-unsubscribe.component.css` dropped — it only set `:host { display: block }`.
- models/project: `client`, `purpose`, `subpurpose`, `tantalisID`, `clFile`, `cpStatus`, `currentPeriod`, `appStatus` and `isLoaded` deleted. No eagle-api Project schema path and no `/api/public/search?dataset=Project` response carries any of them (checked against prod 2026-08-27); they are ACRFD leftovers, so the constructor could never have populated them.
- projects/projlist-list: the card reads fields the payload actually has. Applicant is `proponent.name` instead of the absent `client`, "Purpose / Subpurpose" became "Type / Sector" (`type` / `sector`), and the "Disposition Transaction" (`tantalisID`) and "EAO Project #" (`clFile`) rows are gone — no EPIC field holds either. Angular rendered "Unknown Client" and two "Not Available" rows on every card in prod.
- projects/projlist-list: the comment-period badge dropped. It read `project.currentPeriod`, which the search payload never carries, so every card rendered an empty grey badge; filling it would cost one `/api/commentperiod` request per card.
- api/searchKeywords: `&fields=` no longer sent. eagle-api's `search.js` never reads the parameter and swagger does not declare it on `/public/search`; demi-search lists `fields` in `KNOWN_PARAMS` only so a saved URL does not hit its unknown-parameter 400. Verified on prod: absent, `[object Object]` and real field names all return byte-identical responses. The `{name, value}` pairs are still emitted as `&name=value` above, which is the part that works.
- deps: `bootstrap.bundle.min.js` is no longer imported. The four `data-bs-*` attributes in `header.tsx` were the only Bootstrap JS in the app; the mobile collapse and the two nav dropdowns are React state now. `bootstrap` stays a dependency for `dist/css/bootstrap.min.css`.
- layout/header: the two dropdown toggles are `<button>` instead of `<a role="button">`. They had neither `href` nor `tabindex`, so a keyboard user could not open either menu.
- assets: `styles/layout/layout.css` deleted — never imported by `styles.css` or `index.html`, and it styled `app-root`. `images/marker-icon-2x-yellow.svg` and `marker-icon-2x-yellow-lg.svg` deleted; nothing sets Leaflet's `iconRetinaUrl`. `public/assets` symlinks the whole tree into `dist`, so unreferenced files were being shipped.
- layout/app-shell: a skip-to-main link wired to the existing `.skip-to-main` rules, and `<main id="main-content" tabindex="-1">` as its target. The CSS was already there with nothing using it.
- components/toast-container: `aria-live="polite"` on the container, and the per-toast `role="alert" aria-live="assertive"` removed. A live region created at the same moment as its content is announced unreliably, and two nested regions announce twice.
- projects/proj-detail-popup: "View project" is a `<button>`. It was an `<a>` with no `href`, a `role`, a `tabindex`, a hand-rolled Enter handler and `cursor: pointer` — all of which a button gives for free, Space included.
- pages/search: the download icon activates on Space as well as Enter, and on keydown rather than keyup, which is what a real button does.
- utils/getIdsByName: a term with no `List` entry is skipped instead of reading `_id` off the missing match. The document tabs render before the lists resolve, so Angular's version threw and took the tab down with it.
- pages/project/pins: the pins request asks for the sort the table header shows (`+name`). Angular's `PinsService` sent its own default, `-datePosted`, so the header claimed one order and the rows arrived in another.
- layout/footer: the compact fixed footer for the map page (`app-footer--sm`) is dropped, CSS included. Its Angular binding read a non-signal `router.url` under OnPush, so no deployed build has ever rendered it, and applying it also caught /projects-list, where a fixed footer covers the table.
- pages/project + components/table: the project page's loading states are Bootstrap `.placeholder` skeletons (hero, sidebar details, mini-map, table rows) instead of `spinner-border`; a table that already has rows keeps them dimmed on refetch. Angular showed spinners everywhere.

### Found in the 2026-08-27 parity pass against test

Angular gave every component stylesheet a `[_ngcontent]` attribute on its last compound selector, so
a rule reached only markup that component's own template wrote — never a child component's, never
`[innerHTML]` content — and every selector carried one extra unit of specificity. The port turned
those files into plain global CSS, which drops both effects. Rules that Angular scoped are now
scoped by hand; rules that Angular's scoping made dead are not ported. Those are ports, not
deviations. The deviations the pass turned up are below.

- layout/gate: the curtain is a BC Gov styled page (header bar, card, footer). Angular renders a bare `section.container.static-content`.
- pages/cac-unsubscribe: the hero banner renders styled. The page hand-writes `div.hero-banner.hb-sm` rather than using the hero-banner component, so on test that markup gets no styling at all and the heading sits on a white page.
- pages/comments: an empty comment list says "There are no comments.". Angular's `tableData().totalListItems` starts `undefined`, so neither its `> 0` nor its `=== 0` branch renders and the deployed page shows nothing under the hero.
- state/responsive: `isMobile` tracks the viewport. Angular's `ResponsiveService` read `result.breakpoints[Breakpoints.Tablet]`, a key `BreakpointObserver` never emits (it splits the comma-joined query first), so `isMobile` was true at every width. The project-notification row tab therefore reads "Details" on test at any size and "Project Notification Details" here above 840px. The queries themselves are now the CDK's verbatim, orientation clauses included.
- projects/projlist-map: the opening view fits the filtered projects with even padding. The filter bar sits in the panel rather than floating over the map, so there is no filter-card height to reserve; Angular tried to and failed, passing a component instance where it wanted an element.
- project-notifications: the `info-label` spans are unstyled, as on test. Angular's rule targets `label`, and the template labels the fields with `span.info-label`, so it styled nothing.
- pages/search-help: the stray unbalanced `<section>` that ends the Angular template is not reproduced; it renders as an empty section on test.
- components/table: mobile list rows keep the 1rem gap `assets/styles/components/table.css` asks for. Angular wraps every row in its own component host element, so `.table-template .table tbody tr:last-child { margin-bottom: 0 }` matches every row there and the cards butt together. Reproducing that needs a junk wrapper element around each row.
- components/filters/date-picker: the date range is a native `<input type="date">`, so it shows the browser's locale format and the browser's calendar icon rather than ng-bootstrap's `yyyy-mm-dd` field with its own icon button. Same values on the wire.
- pages/search: a `datePostedStart`/`datePostedEnd` deep link shows its dates in the two date inputs. Both builds send the same `and[datePosted*]` request, but on test the inputs stay empty and Reset Filters stays disabled, so the panel claims no date filter is set.
- map: MapLibre's stylesheet ships with the bundle, so its control styling is present on every page. Angular injected a component's styles only while that component was mounted, so on test the project detail sidebar's map renders with the map library's own control z-indexes.
- layout/header: Escape and a click outside close an open nav dropdown, which Bootstrap's dropdown JS did before it was dropped. Desktop opens the menus on hover (`.dropdown > .nav-link.dropdown-toggle` is `pointer-events: none`), so this only reaches the keyboard path the port opened up.
- project/project: a project the API cannot return renders a "Project not found" page instead of `alert("Uh-oh, couldn't load project")` followed by a redirect to `/projects`. The URL stays put, so the visitor can see which link failed. The list is served by demi-search, whose test corpus was seeded from prod, so it can name projects the test eagle-api has never held; the 23 that did were copied across on 2026-08-28 with `.claude/scripts/epic-backfill-projects.py` in the workspace root.
- utils/safe-html: `safeHtml` runs DOMPurify. Angular's plain `[innerHTML]` went through the DomSanitizer, which strips scripts and event handlers; React's `dangerouslySetInnerHTML` strips nothing. `dompurify` is the one dependency added for it.
- config: a failed `/api/config` is retried three times and then fatal, with an "EPIC is temporarily unavailable" page; `index.html` shows "Loading EPIC…" until the first render. Angular fell back to `env.js` after one 5 s timeout, which shipped `ACCESS_GATE` false and an empty `SEARCH_API_PATH`: the curtain opened and search hit the wrong backend.
- project/project: the Contact Us section sits below the sidebar/content layout, full width above the footer, rather than inside the content column where it started after the sidebar.

## Ports pending

Fixes shipped on `develop` (Angular) not yet re-implemented here. One line each: tag, commit, what. Delete the line when ported.

- none

## Follow-ups

- Unscheduled ideas live in `docs/FUTURE.md` (per-branch preview URLs, automatic create and teardown).

- CAC sign-up drops the Location field. `add-comment.tsx` collects `caclocationInput` but does not send it, and sending it would change nothing: eagle-api's `publicCACSignUp` (`api/controllers/cac.js`) casts the body through `new CACUser(...)`, and `api/helpers/models/cacUser.js` has no location path — mongoose would strip it. `CACObject` in swagger declares only `name`, `email` and `comment`. Fixing this needs an eagle-api change (add the field to the model and the swagger definition) before the frontend can send it. Angular had the same gap.
- `luxon` kept. `models/commentperiod.ts` does America/Vancouver arithmetic, not formatting: `endOf('day')` in Pacific, `minus({days: 7})`, `plus({days: 7})`, `diff(now, 'days')`, hour/minute reads in Pacific and a `ZZZZ` zone name. `Intl.DateTimeFormat` formats in a zone but cannot do zone-aware arithmetic across DST, and `Temporal` is not available. Revisit when `Temporal` ships.
- Non-interactive `tabIndex={0}` on `<td>`, `<h2>`, `<p>`, `<span>` and `<label>` in `pins`, `activity-card`, `home`, `search-filter-template` and `project-notification-documents-table-details` is an Angular-era idiom that puts unactionable content in the tab order (WCAG 2.4.3). Out of scope for the a11y basics pass; needs a decision on how those tables should be navigated.
- Project reads are split across two backends: demi-search serves the project list and every document query, eagle-api serves the project record, pins, comment periods and activities, so the two corpora can disagree. Why, and what has to happen to close it: `eagle-demi/docs/FUTURE.md`, "Serve eagle-public's project reads".
