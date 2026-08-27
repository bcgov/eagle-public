# React migration (branch `react`)

Angular source of truth for behaviour: `/root/repos/eagle-public` (branch `develop`, read-only). This worktree holds the React rewrite. Old Angular `src/` is removed on this branch once phase 1 lands; read the original from the develop checkout.

## Stack (decided 2026-08-27)

- Vite 8, React 19, TypeScript strict, react-router 7 (data router), TanStack Query 5.
- Vitest + jsdom + @testing-library/react. Keep `yarn test`, `yarn lint`, `yarn build` script names.
- Styles: port existing global CSS unchanged (bootstrap.min.css, `src/assets/styles/**`, BCSans, material icons). Component CSS becomes plain global CSS files imported by the component (`:host` becomes a root class). No CSS modules, no design-system library yet.
- Leaflet + markercluster stay CDN globals in `index.html` (typed via `src/types/global.d.ts`).
- `env.js` + `/api/config` runtime config pattern unchanged. `index.html` keeps `<script src="env.js">` before the app bundle.
- Build output must stay `dist/eagle-public/browser` with entry chunk named `main-[hash].js` (deploy workflows `deploy-azure-*.yaml` grep for both). Do not edit workflows.
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

- [ ] 1. Scaffold + foundation + shell + static pages + placeholder pages for every route. Build, lint, test green.
- [x] 2. Table/filter engine + pagination + query-param sync (`components/table`, `components/filters`).
- [ ] 3a. List pages: ~~projects-list, news, project-notifications~~ (done in phase 2); project shell + 7 tabs.
- [ ] 3b. Map page (`/projects`): projlist-map, filters, list, detail popup.
- [x] 3c. Comments + add-comment + file upload + cac-unsubscribe.
- [ ] 3d. Search + content search + search-help.
- [ ] 4. Parity pass, a11y, delete leftovers, README/CLAUDE.md update.

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
