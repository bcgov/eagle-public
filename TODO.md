# React migration (branch `react`)

Angular source of truth for behaviour: the `develop` checkout, read-only. This branch holds the React rewrite. Old Angular `src/` is removed on this branch; read the original from the `develop` checkout.

## Unified search (PUBLIC-146)

None of these block.

- `components/filters/custom-multi-select.tsx` (value picker above 40 options) is a div combobox without the ARIA 1.2 structure. Rebuild it on a real input with `aria-activedescendant`.
- `api.ts:323` concatenates `sortBy` unencoded, so `+name` reaches the wire as ` name`. Encode it once the backend contract is confirmed.
- `src/assets/styles/components/tab-nav.css:101`: the gold active-tab underline measures 1.72:1 against white, under the 3:1 non-text floor. Site-wide design decision.
- `pages/search/unified-search.tsx:798,862`: the scope switch and record-type pills are `aria-pressed` buttons; rebuild them as a radiogroup (`role="radio"`, `aria-checked`).
- The row checkbox is 16px (13px in the passage list on a phone), under the 24px target size; the grid tables share it. Design decision.
- `components/display-grid/guided-tour.tsx:447`: the gold spotlight ring (`--theme-gold-90`) measures 1.73:1 against white, under 3:1. It is the handoff's own token; design decision.
- `modal.tsx:92-95`: drop role=dialog and the eslint-disable; fix update-gallery.spec and open-for-comment.spec that depend on it.
- 2026-10-02: `pages/home/types-chart.tsx:43` still reads `useMediaQuery` live; move it to `useSettledMediaQuery` if it churns in full-page captures.

## Home page redesign

- Once this line serves production, move the update notification email links from the project page to `/updates/:id`.
- 2026-09-23: Accessibility audit of the home page, Map Explorer band and About section included: one h1, labelled landmarks, contrast re-measured, keyboard-only pass.
- Ask the content owner whether the two shortened About row descriptions (Which Act applies, Legislation) need sign-off. Open questions in the v4 handoff README.
- PUBLIC-154 (design, Jira): the ticket says results show on the home page; the design sends them to `/search`. Record the change.
- PUBLIC-136 (Jira): no ticket owns how the home page is put together. Raise one story.
- PUBLIC-160 (Jira): covers the Updates tab, project panel and email, not the home feed. Widen it or point the feed at another ticket.
- PUBLIC-32 (design, Jira): asked for upcoming, open and recently closed periods; the home rail shows open only and links to the `/search` comment periods tab for the rest. Confirm.
- PUBLIC-31 (Jira): asked for cards that expand in place with three buttons each; built as a reader dialog. Record that the ask was set aside.
- PUBLIC-158 (design, Jira): asks for a homepage map; the home page has a slim Map Explorer band linking to `/projects`, not a live map. Confirm whether that satisfies the ticket or it stays open.
- PUBLIC-146 (design): the handoff does not mention the display grid contract. Confirm the home rail rows are exempt.

## Cutover prerequisites

The app has no fallback to eagle-api, so each line blocks the cutover unless it says otherwise.

- Prod demi-search `dataset=CommentPeriod` returns 132 periods where eagle-api holds 143 public ones. Compare counts per dataset between eagle-api and demi-search on prod and fix any gap in eagle-demi.
- Check that a DEMI-created document (UUID id) downloads through the test edge; rule `demidocumentdownloaduuid` in eagle-edge `azure/modules/front-door.bicep`.
- The edge must keep `/api/*` after the cutover: `/api/v2/projects` and `/api/public/*` have outside callers, eagle-admin uses `/api`, and a rollback to `v2.7.x` needs it. Do not drop the `/api` patterns from the public edge at `v3.0.0`.
- Email subscribe is hidden on prod: `NOTIFY_API` is not in the prod config document and eagle-notify has no prod deployment. Decide whether `v3.0.0` ships without it.
- Not blocking: `DEMI_PROJECTS_PATH` is empty in the prod config document (the app defaults to `/demi-projects`); set it to match test.
- Not blocking: `EAGLE_ANALYTICS_URL` is `/api/usage` on test and prod; move it to `/analytics` so it stops looking like an eagle-api call in the logs.
- Proof after cutover: `eagle-logs-prod`, `AzureDiagnostics`, category `FrontDoorAccessLog`, `routingRuleName_s == "eagle-api"`, `referer_s` host `projects.eao.gov.bc.ca` or `www.projects.eao.gov.bc.ca`, referer path not under `/admin`. Count must be 0 apart from 302s of old document links.

## Retired on this line (decided 2026-10-02)

Comment submission and CAC sign-up are gone; decision in `docs/deviations-from-angular.md` (pages/comments).

- Left in eagle-api until it retires: the 85 `CACUser` records (names and emails), the unauthenticated `PUT /api/public/project/:id/cacRemoveMember` route, and the `projectCAC` flag on 18 projects (12 published). Nothing on this line reads them.
- An old emailed `/cac-unsubscribe` link lands on the home page with no message. Decide whether it needs a short notice page.
- eagle-admin can still create a comment period that is not run by ENGAGE. This line shows it read-only.

## Follow-ups

- Display grid: control borders in `display-grid.css` (`--theme-gray-50`, 1.55:1), the same token on the unselected record pill in `unified-search.css`, and the inactive sort arrow (`--theme-gray-60`, 1.54:1) are under the 3:1 floor (WCAG 1.4.11). Design decision before the grid ships to prod.
- After the prod cutover of the unified search page, submit the new `/search` URL to the search engines.
- After cutover, delete `e2e/tools/` and `e2e/tests/css-scoping.spec.ts`; both only compare the Angular and React renderings.
- `src/app/config/config.ts:197,201`: `surveyUrl()` and `showSurveyBanner()` have no consumer. Decide whether the survey returns; if not, delete both and the `SURVEY_URL` / `SHOW_SURVEY_BANNER` config keys.
- 2026-09-22: `docs/unified-search-plan.md` still says four tabs (L28-29, L500, L527) and has no section on the Comment periods tab.
- 2026-09-22: No e2e opens `/search?record=commentPeriods` or follows the home "Upcoming and recently closed periods" link. Add one once the eagle-demi list change is on test.
- 2026-09-22: Search Documents tab: on long names the ellipsis hides the new-tab icon.
- 2026-09-22: Check whether the longer search placeholder is cut off at 390px.
- 2026-09-22: `models/commentperiod.ts:206`: a period whose parent is a project notification links to `/p/<id>/cp/...` instead of `/pn/...`, because the search row does not say what kind of parent it has.

## Updates tab and reader

- 2026-09-23: The Updates tab stays in the strip when its read fails (`isError`); decide whether it should.

## Parity harness follow-ups (added 2026-09-24)

- `e2e/parity/unified-search/reference/manifest.json`: all 30 entries were backfilled from the committed PNGs, so the height check is circular. Replace the manifest on the next full recapture.
- 07-search-help-modal: reference capture fails `helpDialog is modal (top layer)` at 924 and 400; the prototype never calls `showModal`. Decide in states.ts whether that check applies to the prototype.

## Map engagement markers (deferred from review, 2026-09-29)

- proj-detail-popup.tsx:54: initial focus lands on the engagement block, so a screen reader hears the period state before the project name. Focus the heading and put the block after it in DOM order, or use aria-describedby.
- projlist-map.tsx / basemaps.css: pin buttons are aria-hidden, so the open/upcoming state is visual only; under reduced motion "open" differs from "none" by fill hue and glow only (WCAG 1.4.1). Add a text cue reachable by AT.

## Project notification page follow-ups (2026-09-28)

- `src/app/api/notification.ts`: a stored `pcp` overrides the status worked out from dates. Decide whether dates win when both are present.
- `featured-documents.tsx`: the link says "All N documents" with N = featured count, but opens the full Documents tab; show the full count or reword.
- eagle-demi `test/helpers/eagle-mirror-fixtures.js:214`: the notification centroid is [lon, lat], but eagle-admin stores [lat, lon].

## About page follow-ups (2026-09-28)

- Icon sizes use tokens (24px contact icon, 16px new-tab icon) where the handoff says 28px and 18px. Design decision.
- The masthead title and lede start at the container's left edge while the body column is centred. Decide whether to cap the masthead inner block to match.

## Projects by type follow-ups (2026-09-29)

- `demi-search` caps a read at 1000 rows and the band counts rows: past 1000 projects the band says "Showing the first N of M projects", but its counts cover only those rows.
- Search sub-type filter is exact-match; sectors with trailing spaces are being trimmed in eagle-demi #463 plus a backfill; until then the Search link may show fewer projects than the band count.
- Check in Safari that `position: relative` on `<tr>` holds the stretched project links in the table rows.
- `types-tree.ts` buildTypeTree: pick a stable display spelling when sub-types differ only by case (most common spelling, tie by name).

## Map server search follow-ups (deferred from review, 2026-09-29)

- `src/app/api/project.ts`: `searchProjectIds` caps at 500 rows and only logs a warning; show a "first 500 shown" hint in the list header when `totalCount` is above the cap.
- `src/app/api/project.ts`: pass the React Query `signal` from `searchProjectIds` through to `getSearchResults` so a superseded search aborts.
- `src/app/pages/projects/projects.spec.tsx`: add a spec holding search A's results on screen while search B loads.
- `src/app/pages/projects/projects.spec.tsx`: add a spec that fails when the `cleared` rule 2 branch is removed.
- `src/app/pages/projects/projects.spec.tsx`: drop the no-op `advance(300)` in the same-term-retyped spec.
- `src/app/map/basemaps.css`: only engaged pins get the contact shadow; decide whether plain pins and the details-map pin should sit on the ground too.
- `src/app/pages/projects/project-filter.ts`: the publish-date filter reads `dateAdded`, which demi-search never returns, so a URL date range (`?publishFrom=`, `?publishTo=`) drops every project. Either DEMI returns `dateAdded` in the project list or the filter moves to `dateUpdated`.
- `src/app/pages/projects/projlist-map.tsx`: unpicking the last region leaves the map framed on it, so the in-view list stays narrow. Product call.
- `package.json`: declare `@maplibre/maplibre-gl-style-spec` as a devDependency at `^26`. The paint spec imports the hoisted copy, 19.3.3 from `@vis.gl/react-maplibre`, while maplibre-gl uses 26.4.1.

## Pacific Link page (feat-pacific-link) deferred review findings

- 2026-10-01: `pages/project/documents-page.tsx:57`: a failed documents count shows "No documents on EPIC yet" on an extended page, because `fetchData` in `api/search.ts` returns an empty result on any error and `useTable` has no error state.
- 2026-10-01: `routes.tsx:21`, `pages/project/project.tsx:14-17`, `pages/project/overview-tab.tsx:21-23`: extended page blocks, content and CSS are imported eagerly, so they are in the main bundle for every visitor.
- 2026-10-01: `pages/project/extended/content/pacific-link.ts:318,466`: two sentences taken from the design prototype are unattributed claims ("No change to the Oil Tanker Moratorium Act is required."; the Roberts Bank container terminal sentence). Check them against the linked releases.
- 2026-10-01: `index.html:5`: every page title is "EPIC" (site-wide).
- 2026-10-01: The Pacific Link map drawing and layer colours have no automated test.
- 2026-10-01: Live check needed: map canvas focus ring, basemap contrast of the corridor lines, 320 px width with text spacing, Safari list semantics, an axe run (axe-core is not a dependency).
- 2026-10-02: `pages/project/extended/route-lines.tsx:12`, `route-lines.css:5-6,16-22`: the two map lines differ by colour only (WCAG 1.4.1).
- 2026-10-02: `pages/project/extended/route-lines.css:6`: the line-2 red `#c8202f` is not a palette token. `extended-shell.css:12`: the badge text sits on gold; `extended-shell.css:114`: the gold status dot is low contrast. Changing them needs a design decision.
- 2026-10-02: Which projects each environment lists in `EXTENDED_PROJECT_PAGES` belongs on the wiki, as a separate change.
- 2026-10-02: `pages/project/extended/content-tab.tsx:69-70`: the focus fallback is a `div` with `tabIndex=-1` and no role or name (WCAG 2.4.3, 4.1.2).
- 2026-10-02: `pages/projects/projects.tsx:45`: clearing the selection sends another page-view event.

## Legacy document links and read-only comments (deferred from review, 2026-10-02)

- `utils/safe-html.ts` rewrites `<a href>`, `<area href>` and `<img src>` only; an old document path in `srcset`, `<source>`, `<video>` or a CSS `url()` is left to the edge redirect. None seen in prod or test staff HTML.
- `utils/safe-url.ts:37` `fileName()` does not trim the stored link, so a link with a trailing space gets the fallback name (`api/updates.ts`, `pages/search/types/activities.tsx`).
- The two file name fallbacks differ: "Project documents" (`components/update-detail/update-detail.tsx:19`) and "Attached document" (`pages/search/types/activities.tsx:81`); use one.
- `pages/search/types/activities.tsx`: a stored link whose last segment has no file extension is now named "Attached document" where it used to show the segment.
- A comment period that ENGAGE does not run has three labels: "View Engagement" on the engagement tab, "View comment period" on the overview and the map popup, and "View engagement" from `bannerCTA` when closed. Pick one.
- The overview callout and the map popup still say a period not on ENGAGE is "Open for public comment". It is open, but this site has no way to comment. Decide the wording.
- `models/commentperiod.ts`: `hostedOnEngage` and direct `engageUrl` checks do the same job at four call sites. Use one.
- `src/env.js` near the analytics path comment: it still says the rproxy rewrites the path. The edge does.
- `pages/project/decisions-tab.spec.tsx:133` and `project-panel.spec.tsx:120,245,274` reset `DEMI_PROJECTS_PATH` to `''` as if that turns DEMI off. It means `/demi-projects`. Delete the resets or stub the DEMI response.
- `pages/home/open-for-comment.spec.tsx:63` (`findByRole('link', { name: /Cedar LNG/ })`) failed once under verifier load on 2026-10-02 and passed alone and on rerun; add it to the known flaky list if it repeats.
- The Vite dev proxy sends `/api/usage` to the eagle-api host on test, so local analytics posts reach eagle-api and return 404. Point it at the analytics API or drop it.
- The config document's `SEARCH_API_PATH`, `DEMI_PROJECTS_PATH`, `EAGLE_ANALYTICS_URL` and `NOTIFY_API` are used as given. A value under `/api` other than `/api/usage` would send the app to eagle-api. Consider refusing it at load.
