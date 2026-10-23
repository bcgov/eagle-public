# Open work on the `react` branch

Read the Angular behaviour from `develop` with `git show origin/develop:<path>`.

## Cutover prerequisites

The app has no fallback to eagle-api, so each line blocks the cutover unless it says otherwise.

- 2026-10-14 eagle-public: Prod gap: demi-search `dataset=CommentPeriod` returns 133, eagle-api public search 144. Compare counts per dataset on prod and fix the gap in eagle-demi.
- 2026-10-20 eagle-public: Check that a DEMI-created document (UUID id) downloads through the test edge; rule `demidocumentdownloaduuid` in eagle-edge `azure/modules/front-door.bicep`.
- 2026-10-20 eagle-public: At `v3.0.0` keep the `/api/*` patterns on the public edge: outside callers use `/api/v2/projects` and `/api/public/*`, eagle-admin uses `/api`, rollback to `v2.7.x` needs it.
- 2026-10-20 eagle-public: Email subscribe is hidden on test and prod: `NOTIFY_API` is in neither config document and eagle-notify has no prod deployment. Decide whether `v3.0.0` ships without it.
- 2026-10-20 eagle-public: Once prod serves this line, set `NOTIFY_UPDATE_READER_LINKS=true` on eagle-demi prod so update emails link to `/updates/:id`; until then they link to the project page.
- 2026-10-20 eagle-public: Not blocking: set `DEMI_PROJECTS_PATH` in the prod config document to match test (empty now; the app defaults to `/demi-projects`).
- 2026-10-20 eagle-public: Not blocking: move `EAGLE_ANALYTICS_URL` from `/api/usage` to `/analytics` on test and prod, so it stops looking like an eagle-api call in the logs.
- 2026-10-20 eagle-public: After cutover, check `eagle-logs-prod` `AzureDiagnostics`, category `FrontDoorAccessLog`: rows with `routingRuleName_s == "eagle-api"`, `referer_s` host `projects.eao.gov.bc.ca` or `www.`, referer path not under `/admin`, must be 0 apart from 302s of old document links.
- 2026-10-20 eagle-public: After cutover, delete `e2e/tools/` and `e2e/tests/css-scoping.spec.ts`; both only compare the Angular and React renderings.
- 2026-10-20 eagle-public: After the prod cutover of the unified search page, submit the new `/search` URL to the search engines.
- 2026-10-20 eagle-public: When eagle-api retires, drop the 85 `CACUser` records, the unauthenticated `PUT /api/public/project/:id/cacRemoveMember` route and the `projectCAC` flag (18 projects).
- 2026-10-20 eagle-public: An old emailed `/cac-unsubscribe` link lands on the home page with no message. Decide whether it needs a short notice page.

## Accessibility

- 2026-10-20 eagle-public: `components/filters/custom-multi-select.tsx` (value picker above 40 options) is a div combobox without ARIA 1.2 structure. Rebuild it on a real input with `aria-activedescendant`.
- 2026-10-20 eagle-public: `pages/search/unified-search.tsx:737,803`: the scope switch and record-type pills are `aria-pressed` buttons; rebuild them as a radiogroup (`role="radio"`, `aria-checked`).
- 2026-10-20 eagle-public: `modal.tsx:92-95`: drop `role="dialog"` and the eslint-disable; fix `update-gallery.spec` and `open-for-comment.spec`, which depend on it.
- 2026-10-20 eagle-public: Design decision: the gold active-tab underline (`src/assets/styles/components/tab-nav.css:101`) measures 1.72:1 against white, under the 3:1 non-text floor (WCAG 1.4.11).
- 2026-10-20 eagle-public: Design decision: the guided-tour gold spotlight ring (`--theme-gold-90`, `components/display-grid/guided-tour.tsx:447`) measures 1.73:1 against white, under 3:1.
- 2026-10-20 eagle-public: Design decision: the row checkbox is 16px (13px in the phone passage list), under the 24px target size; the grid tables share it.
- 2026-10-20 eagle-public: Design decision before the grid ships to prod: control borders in `display-grid.css` (`--theme-gray-50`, 1.55:1), the same token on the unselected record pill in `unified-search.css`, and the inactive sort arrow (`--theme-gray-60`, 1.54:1) are under 3:1.
- 2026-09-29 eagle-public: `projlist-map.tsx`, `basemaps.css`: pin buttons are `aria-hidden`, so open and upcoming state is visual only. Under reduced motion "open" differs from "none" by fill hue and glow only (WCAG 1.4.1). Add a text cue reachable by AT.
- 2026-10-02 eagle-public: `pages/project/extended/route-lines.tsx:12`, `route-lines.css:5-6,16-22`: the two map lines differ by colour only (WCAG 1.4.1).
- 2026-10-02 eagle-public: Design decision: `route-lines.css:6` line-2 red `#c8202f` is not a palette token; `extended-shell.css:12` badge text sits on gold; `extended-shell.css:114` gold status dot is low contrast.
- 2026-10-01 eagle-public: Check the extended project page live: map canvas focus ring, basemap contrast of the corridor lines, 320 px width with text spacing, Safari list semantics, an axe run (axe-core is not a dependency).
- 2026-09-23 eagle-public: Audit the home page, Map Explorer band and About section: one h1, labelled landmarks, contrast re-measured, keyboard-only pass.
- 2026-09-28 eagle-public: Design decision: the About page icon sizes use tokens (24px contact icon, 16px new-tab icon) where the handoff says 28px and 18px.

## Jira and design reconciliation

- 2026-10-20 eagle-public: Ask the content owner whether the two shortened About row descriptions (Which Act applies, Legislation) need sign-off.
- 2026-10-20 eagle-public: PUBLIC-136: no ticket owns how the home page is put together. Raise one story.
- 2026-10-20 eagle-public: PUBLIC-32 asked for upcoming, open and recently closed periods; the home rail shows open only and links to the `/search` comment periods tab for the rest. Confirm.
- 2026-10-20 eagle-public: PUBLIC-31 asked for cards that expand in place with three buttons each; the page has a reader dialog. Record that the ask was set aside.
- 2026-10-20 eagle-public: PUBLIC-158 asks for a homepage map; the home page has a slim Map Explorer band linking to `/projects`. Confirm it satisfies the ticket or keep it open.
- 2026-10-20 eagle-public: PUBLIC-146: the ticket asks Geoff whether the home rail rows are exempt from the display grid contract. If they are not, move them onto the grid.
- 2026-10-22 eagle-public: PUBLIC-163 C&E to confirm phone 250-387-0131 (constants.ts); chase via Carly Greene Hill (Comms).

## Search and home page

- 2026-10-02 eagle-public: `pages/home/types-chart.tsx:43` reads `useMediaQuery` live; move it to `useSettledMediaQuery` if it churns in full-page captures.
- 2026-09-22 eagle-public: No e2e opens `/search?record=commentPeriods` or follows the home "Upcoming and recently closed periods" link. Add one once the eagle-demi list change is on test.
- 2026-09-22 eagle-public: Search Documents tab: on a long name of a document with no project page (a notification document), the ellipsis hides the new-tab icon.
- 2026-09-22 eagle-public: Check whether the longer search placeholder is cut off at 390px.
- 2026-09-23 eagle-public: The Updates tab stays in the strip when its read fails (`isError`); decide whether it should.
- 2026-10-20 eagle-public: Check on test that `documents/<id>/download#page=N` keeps the `#page=` fragment through the presigned redirect, so passage links open the PDF at that page.
- 2026-10-20 eagle-public: `pages/search/types/activities.tsx`: a stored link whose last segment has no file extension is named "Attached document" where it used to show the segment.
- 2026-10-02 eagle-public: A comment period that ENGAGE does not run has three labels: "View Engagement" (engagement tab), "View comment period" (overview, map popup), "View engagement" (`bannerCTA` when closed). Pick one.
- 2026-10-02 eagle-public: The overview callout and map popup say a period not on ENGAGE is "Open for public comment". It is open, but this site cannot take comments. Decide the wording.

## Parity harness

- 2026-09-24 eagle-public: `e2e/parity/unified-search/reference/manifest.json`: all 30 entries were backfilled from the committed PNGs, so the height check is circular. Replace the manifest on the next full recapture.
- 2026-09-24 eagle-public: `07-search-help-modal` reference capture fails `helpDialog is modal (top layer)` at 924 and 400 because the prototype never calls `showModal`. Decide in `states.ts` whether that check applies to the prototype.

## Projects and maps

- 2026-09-29 eagle-public: Check in Safari that `position: relative` on `<tr>` holds the stretched project links in the projects-by-type table rows.
- 2026-09-29 eagle-public: `pages/projects/project-filter.ts`: the publish-date filter reads `dateAdded`, which demi-search never returns, so a URL date range (`?publishFrom=`, `?publishTo=`) drops every project. Have DEMI return `dateAdded` or move the filter to `dateUpdated`.
- 2026-09-29 eagle-public: `pages/projects/projlist-map.tsx`: unpicking the last region leaves the map framed on it, so the in-view list stays narrow. Product call.
- 2026-09-29 eagle-public: `package.json`: declare `@maplibre/maplibre-gl-style-spec` as a devDependency. `projects.spec.tsx` imports the copy hoisted from `@vis.gl/react-maplibre`, which can differ from the one `maplibre-gl` uses.
- 2026-09-28 eagle-demi: `test/helpers/eagle-mirror-fixtures.js:293`: notification `centroid` is [lon, lat] (`[-120.8, 50.1]`); eagle-admin stores [lat, lon].

## Extended project pages

- 2026-10-01 eagle-public: `pages/project/documents-page.tsx:58`: a failed documents count shows "No documents on EPIC yet" on an extended page, because `useTable` (`components/table/use-table.ts`) has no error state and reads a failed count as 0.
- 2026-10-01 eagle-public: `routes.tsx:21`, `pages/project/project.tsx:14-17`, `pages/project/overview-tab.tsx:21-23`: extended page blocks, content and CSS load eagerly, so they are in the main bundle for every visitor.
- 2026-10-01 eagle-public: `pages/project/extended/content/pacific-link.ts:317,465`: check the Oil Tanker Moratorium Act and Roberts Bank container terminal sentences against the linked releases.
- 2026-10-01 eagle-public: `index.html:5`: every page title is "EPIC" (site-wide).
- 2026-10-02 eagle-public: Wiki `Extended-Project-Pages.md`: list which projects each environment sets in `EXTENDED_PROJECT_PAGES`.
- 2026-10-02 eagle-public: `pages/projects/projects.tsx:45`: clearing the selection sends another page-view event.

## Cleanup

- 2026-10-20 eagle-public: `config/config.ts:216,220`: `surveyUrl()` and `showSurveyBanner()` have no consumer. Decide if the survey returns; if not, delete both and the `SURVEY_URL` and `SHOW_SURVEY_BANNER` keys.
- 2026-10-21 eagle-public: `/search` scrolls sideways at 768 and 1024 px (page width 1183 and 1191). Causes: `table.display-grid__table` at 768, `.new-tab-hint__icon` and `.visually-hidden` spans at 1024. Header not involved.
