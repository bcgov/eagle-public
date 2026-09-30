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
- `src/app/pages/projects/projects.tsx` still builds the `['projects', 'all']` query by hand and caches an empty list when the search fails. Switch it to `allProjectsQueryOptions()` once `feat-map-server-search`, which changes that key, has landed.
- Search sub-type filter is exact-match; sectors with trailing spaces are being trimmed in eagle-demi #463 plus a backfill; until then the Search link may show fewer projects than the band count.
- Check in Safari that `position: relative` on `<tr>` holds the stretched project links in the table rows.
