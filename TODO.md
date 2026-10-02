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

Migration phases 1 to 4 (scaffold, table engine, pages, parity pass against prod) finished 2026-08-27. What remains before prod is under "Cutover prerequisites" and "Follow-ups".

## Unified search (PUBLIC-146)

Done 2026-09-17. One `/search` page and one display grid replaced `/projects-list`, `/search`, `/news` and `/project-notifications`. Phases 1 to 6 landed as PRs #881 to #889 on `react`, live on the next site as `v3.0.0-beta.37` (efc62432). Plan and detail: `docs/unified-search-plan.md`; behaviour changes in `docs/deviations-from-angular.md` (URLs section); redirect table on the `eagle-dev-guides.wiki` page `Eagle-Search`.

The design prototype sits at `design/handoffs/unified-search/`, local only and never committed; the source archive is kept at `/root/repos/eagle-public-design-handoff.zip` and can be unzipped again if the directory is missing.

Still open in eagle-demi `TODO.md`: 7.5 re-extraction on test (about 6 days from 2026-09-16, adds "Page N" labels as it goes); 0.6 (counts equal `/search` totals) verified 2026-09-17. Test-only cosmetic: 9 List names appear twice in the filters because the old test rows sit beside the reseeded prod ids.

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

Follow-ups from phase 5, none of them blocking:

- The gold spotlight ring in `guided-tour.tsx` (`--theme-gold-90`) measures 1.73:1 against white, under the 3:1 a non-text indicator needs. It is the handoff's own token and the dim panels around it carry the spotlight, so changing it is a design decision.
- `search-help-dialog.tsx` keeps a redundant `role="dialog"` on a native `<dialog>`. The parity gate and the e2e walk resolve the dialog through a `[role="dialog"]` selector; drop it when those selectors move off the role.
- On a phone the tour counts only the steps it can show ("Step 4 of 6"), since the column filter row is not rendered below 720px; the prototype keeps "of 7" and skips the missing step in silence. Ours is the plan's rule; the difference is one digit and sits under the pixel threshold.

Follow-ups from phase 6, none of them blocking:

- Migrate `pages/comments/comments.tsx` and `project-notifications/project-notification-documents-table.tsx` off `TableTemplate` onto `DisplayGrid`, then delete `components/table/*`. Both are small fixed tables inside a page rather than list pages, so neither blocks the search work.
- `responsive.ts` reads `matchMedia` live, so any component gated on it re-renders during a full-page capture's one-frame 1px viewport (the table branch of `display-grid.tsx` unmounts and remounts). The tour now tolerates it; other width-gated components may still churn in that frame. Consider debouncing the `narrow` snapshot by a frame.

## Home page redesign

Plan and detail: `docs/home-redesign-plan.md`; behaviour changes in
`docs/deviations-from-angular.md` ("Home page redesign" section).

The v4 design handoff sits at `design/handoffs/home-v4/`, local only and never
committed; the original archive it came from was not kept. v4 supersedes v3: it drops the masthead purpose line and the
Map Explorer preview image, and adds an About section above the footer. The v2 handoff
stays at `design/handoffs/home/` with its archive at
`/root/repos/eagle-public-design-handoff-home.zip`, as the record of what v2 shipped.

Update notification emails still link to the project page; they move to `/updates/:id`
once this line serves production.

Open (moved from the redesign tracker, 2026-09-23):

- Accessibility audit of the home page, not done yet: one h1, labelled landmarks,
  contrast re-measured, keyboard-only pass. Covers the Map Explorer band and the About
  section too.
- Confirm the About section's anchors and copy with the content owner: whether the
  two shortened About row descriptions (Which Act applies, Legislation) need
  sign-off. Open questions in the v4 handoff README.
- Take these back to design and Jira. PUBLIC-142 and PUBLIC-152 are settled in the plan.
  - PUBLIC-154: the ticket says results show on the home page. The design sends them to
    `/search`. Record the change.
  - PUBLIC-136: no ticket owns how the home page is put together. Raise one story.
  - PUBLIC-160: covers the Updates tab, project panel and email, not the home feed. Widen
    it or point the feed at another ticket.
  - PUBLIC-32: asked for upcoming, open and recently closed periods. The home rail shows
    open only and links to the `/search` comment periods tab for the rest. Confirm.
  - PUBLIC-31: asked for cards that expand in place with three buttons each. Built as a
    reader dialog. Record that the ask was set aside.
  - PUBLIC-158: asks for a homepage map. The home page now carries a slim Map Explorer
    band with a button linking to `/projects`, not a live map. Confirm whether that
    satisfies the ticket or whether it stays open; not yet confirmed with design or
    Jira.
  - PUBLIC-146: the handoff does not mention the display grid contract. Confirm the rail
    rows are exempt.

## Port rules (added 2026-08-27)

- Do not port bugs or inefficiencies. When the Angular code is wrong, wasteful (redundant fetches, N+1, dead caches, needless re-renders), or dead, fix or drop it in the port.
- Every deliberate behaviour change goes in `docs/deviations-from-angular.md`, one line: file, what changed, why. Parity tests against prod may flag these; the list explains them.
- Cut dependencies where a native API or a few lines do the job. Justify each dependency kept in `package.json` by real use; remove anything unused.

## Cutover prerequisites

Checked 2026-10-02 against the live prod edge, the prod config document and the next site (`v3.0.0-beta.54`). The app builds no request to eagle-api: a browser walk of every route on the next site saw only `/demi-search/*`, `/demi-projects/*`, the analytics beacon, App Insights, map tiles and presigned files. There is no fallback to eagle-api, so each open line below blocks the cutover.

Open:

- Prod DEMI is missing data. `dataset=CommentPeriod` returns 1 period on prod where eagle-api holds 143 public ones, a legacy period with 15 comments in eagle-api returns 0 from DEMI, and `dataset=RecentActivity` returns 17 rows (test has 662). Until the prod backfill runs, the Engagement tab, the comment pages and the Updates feed would be close to empty. Find out whether this is a missing backfill or a visibility rule, fix it in eagle-demi, then compare counts per dataset between eagle-api and demi-search on prod.
- Old document links. `/api/public/document/:id/download` and `/api/document/:id/fetch` are public permalinks (about 32,500 requests a day on prod) and staff still paste them into updates and comment period instructions. They need the Front Door redirects to `/demi-search/documents/:id/download?redirect=1` (eagle-edge branch `feat-legacy-document-redirects`), proven on the test edge, then deployed to prod. Links shown inside this app do not wait for that: `rewriteLegacyDocumentUrl` points them at the DEMI download before they render. Behaviour change: the file always downloads (PDFs no longer open in the tab) and the file name is the stored one.
- `/demi-search/search/counts` returns 404 at the edge on test and prod. The search page falls back to one request per record type. Fixed by a rewrite rule on the same eagle-edge branch.
- A document created in DEMI has a UUID id, and the edge download rule matches 24-hex ids only, so its download link returns 404. Fixed on the same eagle-edge branch; check with a real DEMI-created document on test.
- The edge must keep `/api/*` after the cutover. `/api/v2/projects` and `/api/public/*` have outside callers, eagle-admin uses `/api`, and a rollback to `v2.7.x` needs it. Do not drop the `/api` patterns from the public edge at `v3.0.0`.
- Email subscribe is hidden on prod: `NOTIFY_API` is not in the prod config document and eagle-notify has no prod deployment. Decide whether `v3.0.0` ships without it.

Done, checked on prod:

- The config document carries `SEARCH_API_PATH=/demi-search`. `CONFIG_PATH` is not needed in the document; the app defaults to `/demi-search/config`.
- `DEMI_PROJECTS_PATH` is empty in the prod document. The app defaults to `/demi-projects`, so it works; set it to match test.
- `EAGLE_ANALYTICS_URL` is `/api/usage` on test and prod. The edge sends `/api/usage/*` to the analytics API, not to eagle-api. Moving it to `/analytics` is optional and would stop the path looking like an eagle-api call in the logs.
- The edge serves `/demi-search/gate`, `/demi-search/documents/:id/download` (24-hex ids) and the bulk-download routes. The rproxy is scaled to 0, so the eao-nginx version no longer matters.
- Prod ships `ACCESS_GATE` false, so DEMI prod does not need `ACCESS_GATE_PASSWORD`.

Proof after cutover: on workspace `eagle-logs-prod`, table `AzureDiagnostics`, category `FrontDoorAccessLog`, route `routingRuleName_s == "eagle-api"`, count requests whose `referer_s` host is `projects.eao.gov.bc.ca` or `www.projects.eao.gov.bc.ca` and whose referer path is not under `/admin`. The count must be 0 apart from the 302 redirects of old document links.

## Retired on this line (decided 2026-10-02)

- Comments are read-only. The public cannot submit a comment or attach a file; ENGAGE owns submission. On the Angular line the attachment upload already failed, because it posted to a staff-only route.
- CAC sign-up and removal are gone. Prod holds 85 sign-ups, the last on 2024-10-26, none in 2025 or 2026. The Angular line called routes that do not exist, so it could not sign anyone up either.
- Left behind in eagle-api until it retires: the 85 `CACUser` records (names and emails), the unauthenticated `PUT /api/public/project/:id/cacRemoveMember` route, and the `projectCAC` flag on 18 projects (12 published). Nothing on this line reads them.
- An old emailed `/cac-unsubscribe` link lands on the home page with no message. Decide whether it needs a short notice page.
- eagle-admin can still create a comment period that is not run by ENGAGE. This line shows it read-only.

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
- `surveyUrl()` and `showSurveyBanner()` in `src/app/config/config.ts` have no consumer since the home redesign removed the survey banner. Decide whether the survey returns somewhere else; if not, delete both and the `SURVEY_URL` / `SHOW_SURVEY_BANNER` config keys.
- Project reads all come from demi-search now, so the two corpora can no longer disagree. Background on why the split existed: `eagle-demi/docs/FUTURE.md`, "Serve eagle-public's project reads".
- Comment periods search tab, open items (2026-09-22):
  - `docs/unified-search-plan.md` still says four tabs (L28-29, L500, L527) and has no section on the Comment periods tab.
  - No e2e opens `/search?record=commentPeriods` or follows the home "Upcoming and recently closed periods" link. Add one once the eagle-demi list change is on test.
  - Documents tab: on long names the ellipsis hides the new-tab icon.
  - `periodDates` shows "Opens <date>" even when the date is years in the past.
  - `open-for-comment.spec.tsx` has no case for `projectName: ''`.
  - The home card shows dates in the browser's time zone (`longDate`); search rows show Pacific.
  - Check whether the longer search placeholder is cut off at 390px.
  - A period whose parent is a project notification links to `/p/<id>/cp/...` instead of `/pn/...`, because the search row does not say what kind of parent it has.

## Updates tab and reader

- 2026-09-23: Document what `ALL_ROWS_PAGE_SIZE` in `src/app/api/api.ts` is for and who pages with it.
- 2026-09-23: `LEADING_BLOCK` in `updates.ts` misses content that starts with bare text before any block tag, so the summary falls back to later text.
- 2026-09-23: Content that starts with an empty block (`<p></p>`) gives a blank summary; skip empty blocks.
- 2026-09-23: Unnamed attachments are numbered by position in the whole list, so the only unnamed one can be "Document 2"; number unnamed ones on their own.
- 2026-09-23: Encode the project id in the `/p/:projId/...` links built from Update rows.
- 2026-09-23: Decide the retry option on the project updates query, so an error shows without the default backoff wait.
- 2026-09-23: Spec fixtures should use the real `featuredImage` object shape from DEMI.
- 2026-09-23: The update-card spec's `/overview/` link assertion is a no-op; assert on a link that would really appear.
- 2026-09-23: The subject shows twice on a corporate update (meta line and "About:").
- 2026-09-23: The featured image crops with `object-fit: cover`; use `contain` so charts and maps stay whole.
- 2026-09-23: The Documents list keys on the document id, which repeats when an attachment is also the legacy `documentUrl`.
- 2026-09-23: Add the new Update fields (shortHeadline, summary, category, publishDate) to the `HOME_FEED` fixture.
- 2026-09-23: The `waitFor` at `update-reader.spec.tsx:176` passes before the failed read settles; wait on the settled read instead.
- 2026-09-23: Skip the `/demi-projects` read in the reader when the Update already carries a location.
- 2026-09-23: Point "See recent updates" at the home page updates list anchor, not `/`.
- 2026-09-23: The reader's feed-row lookup matches on id only and ignores the row kind.
- 2026-09-23: Nothing sets the route-state `projectId` the reader reads; add a caller or delete the branch.
- 2026-09-23: The home feed card shows the headline; use shortHeadline with the headline as fallback.
- 2026-09-23: Add a test for the rule that keeps the open tab in the project strip, apart from the Updates case.
- 2026-09-23: Keep the Updates tab count live region mounted so screen readers announce changes.
- 2026-09-23: The Updates tab stays in the strip when its read fails (`isError`); decide whether it should.

## Parity harness follow-ups (added 2026-09-24)

- README.md: say that `--update-snapshots` on the command line still overwrites references despite `updateSnapshots: 'none'`; the SHA check only catches it on the next run.
- capture-reference.ts: run the prototype capture-twice check before the capture loop, so an unstable prototype cannot overwrite references first.
- capture-reference.ts and unified-search.parity.spec.ts: use `stateById()` instead of `STATES.find(...)!` so a renamed state gives a named error.
- reference-check.ts: validate manifest shape (plain object, each entry has width, pageHeight, fullPage, sha256) so a `null` manifest or missing field gives a named problem, not a TypeError.
- reference-check.ts: move the `scope` helper to module level.
- reference-check.spec.ts: cover `expectedReferences()` (a `viewportOnly` state maps to `fullPage: false`, e.g. 06-multiselect-picker) and the parked flag passed to `gate`.
- stay-local.spec.ts: add a browser test that `keepLocal` really aborts an external fetch and WebSocket through the context and fails the test at teardown.
- tokens.ts: reword the header so the `literal('solid')` exception is allowed.
- unified-search.parity.spec.ts: in the capture-twice test, check `stopped` only after the try block succeeds, so a thrown error or skip is not hidden.
- unified-search.parity.spec.ts: drop `baseURL`/`permissions` passed from `test.info().project.use` if Playwright already applies them to `browser.newContext()`; confirm first.
- unified-search.parity.spec.ts: use `widthsFor(state)` instead of `WIDTHS` in the capture-twice loop.
- unified-search.parity.spec.ts: move `.unified-search__query` and `[data-tour="types"]` into selectors.ts.
- reference/manifest.json: all 30 entries were backfilled from the committed PNGs (07-search-help-modal cannot be captured yet), so the height check is circular until references are recaptured. Replace the manifest on the next full recapture.
- 07-search-help-modal: reference capture fails `helpDialog is modal (top layer)` at 924 and 400 on the base commit too; the prototype never calls `showModal`. Decide in states.ts whether that check applies to the prototype.

## Map engagement markers (deferred from review, 2026-09-29)

- api/commentperiod.ts: status searches have no sortBy; if the 100-row cap is ever hit, sort open by dateCompleted and upcoming by dateStarted.
- projects.tsx: engagement is classified only when query data changes (5 min staleTime); a period that opens or closes while the page is open keeps its old pin state until refetch.
- proj-detail-popup.tsx: initial focus lands on the engagement block; screen reader hears the period state before the project name. Consider focusing the heading and putting the block after it in DOM order, or an aria-describedby.
- projlist-map.tsx / basemaps.css: pin buttons are aria-hidden, so the open/upcoming state is visual only; under reduced motion "open" differs from "none" by fill hue and glow only (WCAG 1.4.1). Add a text cue reachable by AT (list card or popup already carries it).
- basemaps.css: open ripple loops forever (WCAG 2.2.2 wants a stop control for motion over 5 s). Accepted for now.
- basemaps.css: engaged cluster count is white on #4daa57 at 2.92:1 (below 4.5:1). Accepted for now.
- basemaps.css: rationale comments at the glow/fill block exceed the comment cap; move contrast figures to the PR.
- api/commentperiod.ts and api/api.ts both define a 500 page-size constant; export one.

## Project notification page follow-ups (2026-09-28)

- `src/app/layout/app-shell.tsx` getPageName: skip the `pn` segment like `p` and `cp`, so analytics page names are not "Pn > Overview".
- `src/app/routes/legacy-search.ts` SORTABLE_FIELDS.notifications: set to `['name', 'notificationReceivedDate']`; dateUpdated has no column.
- `src/app/api/notification.ts`: a stored `pcp` overrides the status worked out from dates. Decide whether dates win when both are present. Also drop `/i` on the ObjectId regex or lower-case the id before the read, since the Cosmos point read is case-sensitive.
- `src/app/pages/project/project-panel.tsx`: hide "Open in map explorer" for notifications; the explorer lists projects only.
- `src/app/pages/project/use-engagement-periods.ts`: build the inline fallback only after the periods query settles, so the tab count does not flicker.
- `src/app/pages/search/types/notifications.ts:18`: restore the typeof string guard on associatedProjectId.
- `src/app/models/projectNotification.ts`: type proponent as `string | { name?: string } | null`.
- `src/app/components/table/document-row.ts`: delete the unused `useDocumentRow`; the `.clickable-row` rules in `table.css` are dead.
- `overview-tab.tsx:335`: fix "1 documents" grammar. In `project.tsx`, the tab count needs a hidden separator so the accessible name reads correctly.
- e2e: ids in `fixtures/unified-search/notifications.json` should be 24-hex; add notifications to the grid row hover parity check; `project-notification.spec.ts:29` should assert the full masthead text.
- eagle-demi `test/helpers/eagle-mirror-fixtures.js:214`: the notification centroid is [lon, lat], but eagle-admin stores [lat, lon].

## About page follow-ups (2026-09-28)

Review polish items left after the unified About page landed. None block the page.

- `src/app/pages/about.tsx`: drop the `event.button` check and the `matchMedia?.` guard; consider `aria-current="location"` for the rail; add `role="list"` on `.about-acts` and `.about-contacts` for Safari.
- `src/app/pages/about.tsx` rail hold (`held` ref): record `scrollY` when the hold starts and clear the hold on any change over 1px instead of using `isAtBottom`, so a 1 to 4px scroll up and back down shows Contact and a resize that changes `innerHeight` keeps the hold; hold from the hash only when `useNavigationType() !== 'POP'`; a jump whose clamped target equals the current `scrollY` fires no `scrollend` and stays pinned until the next gesture, so release at once in that case; reset `pinned.current` in the effect cleanup; in `release`, keep the hold only when `scrollY` equals the computed target.
- `src/app/pages/about.spec.tsx`: cover the `top >= 0` half of the hold, a resize after a click hold, the small-scroll-then-bottom case, a jump with no scroll, and a hash that names a non-section id.
- `src/app/pages/about.css`: the current-link background `#faf9f8` is invisible on the page grey `#f7f8fa`; scope the inset left bar to the 768px-and-up block; delete the dead `max-width: 760px` on the content column; the comment says the rail floor wins below 1296px, the real threshold is 1232px.
- Icon sizes use tokens (24px contact icon, 16px new-tab icon) where the handoff says 28px and 18px. Design decision.
- `src/app/pages/about.spec.tsx`: cover the bottom-of-page rule, pin release by `scrollend` and by the timer, the resize listener, reduced motion, `replaceState` keeping `history.state`, and all four modifier keys.
- `src/app/layout/app-shell.spec.tsx`: stub `scrollIntoView` and assert it is called on `#contact`, so the hash arrival is proven at unit level.
- `src/app/routes.spec.ts`: drop the `Component toBeUndefined` shape checks; the loader location check already proves the redirect.
- `e2e/tests/page-layout.spec.ts`: assert `.about__content` is centred at 1600 wide and the rail clears the column at 860 and 1024.
- `e2e/tests/static-pages.spec.ts`: raise the `expectSectionAtTop` lower bound to about 16 so the 24px offset is tested; move the `aria-current` checks after the pin releases and add a tall-viewport Compliance case; drop the exact `toHaveCount(7)` on new-tab links.
- `e2e/tests/smoke.spec.ts`: the `/legislation` redirect case duplicates static-pages.
- The masthead title and lede start at the container's left edge while the body column is centred. Decide whether to cap the masthead inner block to match.

## Projects by type follow-ups (2026-09-29)

- `demi-search` caps a read at 1000 rows and the band counts rows. Past 1000 projects the band says "Showing the first N of M projects", but its counts still cover only those rows.
- Search sub-type filter is exact-match; sectors with trailing spaces are being trimmed in eagle-demi #463 plus a backfill; until then the Search link may show fewer projects than the band count.
- Check in Safari that `position: relative` on `<tr>` holds the stretched project links in the table rows.
- 2026-09-30: `allProjectsQueryOptions` throws on failure with no `retry` override, so while demi-search is down each mount makes up to 4 full-list calls; consider `retry: 1` or `retryOnMount: false`.
- 2026-09-30: `ALL_PROJECTS_TOTAL_KEY` sits under the `['projects','all']` prefix; a future prefix invalidation would hit the skipToken total query. Use a sibling key.
- 2026-09-30: Truncation note uses `projects.length` (includes rows without `_id`) while the chart total excludes them; use the chart total.
- 2026-09-30: Other-type footer wording: "Other" is a real type Search can filter; the band's Other also merges blank and unlisted types. Reword to say Search's Other filter shows fewer. Same for the Other sub-type, which also holds sectors literally named "other".
- 2026-09-30: Sub-types merge across case but the Search link and `?subType=` matching use the first-seen spelling; match case-insensitively in `useTypeLevel` and pick a stable display spelling.
- 2026-09-30: Home e2e baseline holds only while the band sits more than 200px below a 900px fold; note the dependency in static-pages.spec.ts.
- 2026-09-30: Add an unmount test for `useNearViewport` (observer disconnect), assert every Search column has a width in projects.spec.ts, and simplify `sel && focus` in types-chart.tsx.

## Map server search follow-ups (deferred from review, 2026-09-29)

- `src/app/api/project.ts`: `searchProjectIds` caps at 500 rows and only warns on the console; show a "first 500 shown" hint in the list header when `totalCount` is above the cap, and pass the React Query `signal` through to `getSearchResults` so a superseded search aborts.
- `src/app/api/api.ts`: `searchKeywords` now encodes for every caller (unified search, `use-table`, bulk download); a `+` reaches the server as a literal plus. Add a spec per caller.
- `src/app/pages/projects/projects.tsx`: log a failed keyword search through the app logger (only `periodsError` is logged today); show a busy indicator while a search is in flight so the previous count does not read as the answer; de-duplicate ids from the index before mapping; show the comment-period error only when the failed read is the chosen state.
- `src/app/pages/projects/projects.spec.tsx`: add a spec holding search A's results on screen while search B loads; add a spec that fails when the `cleared` rule 2 branch is removed; drop the no-op `advance(300)` in the same-term-retyped spec.
- `src/app/map/basemaps.css`: only engaged pins get the contact shadow; decide whether plain pins and the details-map pin should sit on the ground too.
- `src/app/pages/projects/project-filter.ts`: the publish-date filter reads `dateAdded`, which demi-search never returns, so a URL date range (`?publishFrom=`, `?publishTo=`) drops every project. Either DEMI returns `dateAdded` in the project list or the filter moves to `dateUpdated`.
- `src/app/pages/projects/projects.tsx`: `sortNote` is never cleared, so the live result count repeats "Sorted by ..." on every count change after a sort.
- `src/app/pages/projects/projects.spec.tsx`: the map-pick analytics spec should assert the call count, one `Project Filters Applied` per pick.
- `src/app/pages/projects/projects.spec.tsx`: no spec for a map click on no feature closing the card, or for the `.maplibregl-marker` click guard.
- `src/app/pages/projects/projlist-list.tsx`: while loading, the count reads only ". Sorted by X" (hidden text with no count before it).
- `src/app/pages/projects/projlist-map.tsx`: unpicking the last region leaves the map framed on it, so the in-view list stays narrow. Product call.
- `src/app/pages/projects/projlist-map.tsx`: a programmatic fit keeps the desktop region tip at the old pointer point until the next mousemove.
- `package.json`: declare `@maplibre/maplibre-gl-style-spec` as a devDependency at `^26`. The paint spec imports the hoisted copy, 19.3.3 from `@vis.gl/react-maplibre`, while maplibre-gl uses 26.4.1.
- `src/app/pages/projects/projlist-map.tsx`: after a region-click fit, the hover highlight stays on the old polygon until the pointer moves.
- `src/app/pages/projects/projlist-map.tsx`: the deferred desktop pick reads `regionNames` from 300 ms earlier, when the click happened.

## Pacific Link page (feat-pacific-link) deferred review findings

- 2026-10-01: `pages/project/documents-page.tsx:57`: when the documents count fails to load, an extended project page shows "No documents on EPIC yet". `fetchData` in `api/search.ts` catches every error and returns an empty result, and `useTable` does not return error state, so a failure looks like zero.
- 2026-10-01: `pages/project/use-project-tab-meta.ts:56`: `pending` is `!totalListItems && loading`, and `loading` is `isFetching`. Returning to an empty Documents tab after the 5-minute stale time briefly shows the full filter and table before the empty card. Base `pending` on "no data yet".
- 2026-10-01: `pages/project/documents-page.tsx:101`: the document filter's analytics send the record name while the tab bar sends the display name.
- 2026-10-01: `utils/legislation.ts:31,37` and `pages/project/extended/content/pacific-link.ts:32,211`: the Building Canada Act and 2018 Environmental Assessment Act URLs are each defined twice, in two forms.
- 2026-10-01: `pages/project/extended/blocks/timeline-block.tsx:39` and `extended-shell.tsx:75`: the timeline shows "date · state", the rail shows "state · date".
- 2026-10-01: `pages/project/extended/extended-shell.tsx:122`: the thumbnail's error boundary has no fallback; a failed map chunk leaves an empty box above the caption.
- 2026-10-01: `pages/project/project.tsx:145`: if the record fetch fails, an extended project page shows "Project not found" although its content is static.
- 2026-10-01: `routes.tsx:21`, `pages/project/project.tsx:14-17`, `pages/project/overview-tab.tsx:21-23`: extended page blocks, content and CSS are imported eagerly, so they are in the main bundle for every visitor.
- 2026-10-01: `pages/project/extended/content/pacific-link.ts:318,466`: two sentences taken from the design prototype are unattributed claims ("No change to the Oil Tanker Moratorium Act is required."; the Roberts Bank container terminal sentence). Check them against the linked releases.
- 2026-10-01: `index.html:5`: every page title is "EPIC" (site-wide).
- 2026-10-01: `map/basemaps.css:64`: the map control buttons keep maplibre's default focus ring, a blurred shadow at about 3:1 contrast (shared).
- 2026-10-01: Not run: `test:parity` (needs `PREPUSH_E2E=1`) and the e2e package (dependencies not installed). The real map drawing and layer colours have no automated test.
- 2026-10-01: Needs a live check: map canvas focus ring, basemap contrast of the corridor lines, 320 px width with text spacing, Safari list semantics, an axe run (axe-core is not a dependency).
- 2026-10-02: `pages/project/extended/route-lines.tsx:12`, `route-lines.css:5-6,16-22`: the two map lines differ by colour only (WCAG 1.4.1). The owner turned down a dashed line, so both stay solid.
- 2026-10-02: `pages/project/extended/route-lines.css:6`: the line-2 red `#c8202f` is not a palette token. `extended-shell.css:12`: the badge text sits on gold; `extended-shell.css:114`: the gold status dot is low contrast. All three are the approved look from the design handoff; changing them needs a design decision.
- 2026-10-02: Act-specific code outside the Act registry in `utils/legislation.ts`, kept on purpose: `pages/project/assessment-stages.ts:67,163,247` (the 'detailed' stages are the 2018 table), `pages/about.tsx:27-45,266-269`, `pages/home/about-band.tsx:8`, `pages/search/types/documents.ts:71` (`${year} Act`), `pages/search/search-filters.ts:41`, and the Act URLs in `pages/project/extended/content/pacific-link.ts:32,211`.
- 2026-10-02: `layout/page-masthead.tsx:64`: the eyebrow badge comes after the title in the DOM and is shown above it. Kept on purpose, so heading navigation lands on the title first.
- 2026-10-02: `assessment-stages.ts:194`: `actYear` still reads a year the Act registry does not hold (a spec expects 2031 for "2031 Environmental Assessment Act"), so it keeps its own year match.
- 2026-10-02: Which projects each environment lists in `EXTENDED_PROJECT_PAGES` belongs on the wiki, as a separate change.
- 2026-10-02: `pages/project/extended/content-href.ts:19`: any `mailto:` passes, including `?cc=`, `&bcc=` and `&body=` parameters; any `https:` passes, including a user part (`https://gov.bc.ca@other.example`).
- 2026-10-02: `pages/project/extended/content-link.tsx:32-34`: a site path is always a client-side link. A site path the app does not route (a file under `/assets/`, an `/api/` download) is caught by the `*` route and goes home. No content does this today.
- 2026-10-02: `pages/project/extended/content-link.tsx:38-39`: a refused href drops `className`, so in the masthead a refused action shows as bare text.
- 2026-10-02: `pages/project/extended/content-tab.spec.tsx:84`: the focus-flag test does not check that the query and hash are kept. `:100-109` checks DOM structure, not an accessible name.
- 2026-10-02: `pages/project/extended/content-tab.tsx:19` and `pages/project/extended/blocks/updates-block.tsx:58`: which block holds focus is decided in two places, so a full updates list in `aside`, `banner` or an Overview append can take focus. `pages/project/extended/use-focus-tab-title.ts:34`: each hook instance sends its own replace navigation.
- 2026-10-02: `pages/project/extended/content-tab.tsx:97-98`: the focus fallback is a `div` with `tabIndex=-1` and no role or name (WCAG 2.4.3, 4.1.2).
- 2026-10-02: `pages/project/extended/rich-text.tsx:23`: `new RegExp` with lookbehind and `\p{}` throws on browsers older than Safari 16.4 and takes the render down; wrap it in try/catch. `:38`: `cited.match` has no word boundary. `:51`: lookup by `toLowerCase()` can miss what the `iu` pattern matched, and autoLinks equal apart from case overwrite each other.
- 2026-10-02: `pages/project/extended/route-map.tsx:52`: a refused URL is thrown inside the query function and retried once. `:70-71`: the extent reads only Point and LineString. `:209-210`: marker state survives a URL change from A to B and back to A.
- 2026-10-02: `pages/project/extended/validate-extended-page.ts:64`: `band.primary.tab` and `updates.tab` may name a standard tab, which never reads the focus flag. `:76`: several lists are keyed by content values the duplicate check does not cover (masthead actions, links, definitions, table rows, columns, steps, stats, projects, external documents). `:115`: `label`, `title`, `intro`, `count` and `layout` on an Overview append entry are ignored with no problem line. Nothing checks autoLinks, so two equal apart from case are accepted.
- 2026-10-02: `pages/projects/projects.tsx:41`: `selected` is read from the URL once, at mount. `:45`: clearing the selection sends another page-view event.
- 2026-10-02: `routes.tsx:157`: no test for a deeper path under a static child (`/p/:id/documents/foo`) or for the `cp` cases that go to Overview.

## Legacy document links and read-only comments (deferred from review, 2026-10-02)

- `utils/safe-html.ts` rewrites `<a href>`, `<area href>` and `<img src>` only. Any other tag or attribute in staff HTML that points at an old document path (`srcset`, `<source>`, `<video>`, a CSS `url()`) is left as written and answered by the edge redirect. None seen in the data; every old link found in prod and test staff HTML is a plain `<a>`.
- `utils/safe-html.ts`: plain text with no tag is now re-serialised, so `&` comes back as `&amp;`. It renders the same.
- `api/updates.ts` and `pages/search/types/activities.tsx`: `fileName()` runs on the stored link without trimming, so a link with a trailing space gets the fallback name. The two fallbacks differ ("Project documents", "Attached document"); use one.
- `pages/search/types/activities.tsx`: a stored link whose last segment has no file extension is now named "Attached document" where it used to show the segment.
- A comment period that ENGAGE does not run has three labels: "View Engagement" on the engagement tab, "View comment period" on the overview and the map popup, and "View engagement" from `bannerCTA` when closed. Pick one.
- The overview callout and the map popup still say a period not on ENGAGE is "Open for public comment". It is open, but this site has no way to comment. Decide the wording.
- `models/commentperiod.ts`: `hostedOnEngage` and direct `engageUrl` checks do the same job at four call sites. Use one.
- `src/env.js` near the analytics path comment: it still says the rproxy rewrites the path. The edge does.
- `pages/project/decisions-tab.spec.tsx:133` and `project-panel.spec.tsx:120,245,274` reset `DEMI_PROJECTS_PATH` to `''` as if that turns DEMI off. It means `/demi-projects`. Delete the resets or stub the DEMI response.
- `pages/home/open-for-comment.spec.tsx:63` (`findByRole('link', { name: /Cedar LNG/ })`) failed once under verifier load on 2026-10-02 and passed alone and on rerun; add it to the known flaky list if it repeats.
- The Vite dev proxy sends `/api/usage` to the eagle-api host on test, so local analytics posts reach eagle-api and return 404. Point it at the analytics API or drop it.
- The config document's `SEARCH_API_PATH`, `DEMI_PROJECTS_PATH`, `EAGLE_ANALYTICS_URL` and `NOTIFY_API` are used as given. A value under `/api` other than `/api/usage` would send the app to eagle-api. Consider refusing it at load.
