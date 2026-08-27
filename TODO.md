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
- [ ] 2. Table/filter engine + pagination + query-param sync (`components/table`, `components/filters`).
- [ ] 3a. List pages: projects-list, news, project-notifications; project shell + 7 tabs.
- [ ] 3b. Map page (`/projects`): projlist-map, filters, list, detail popup.
- [ ] 3c. Comments + add-comment + file upload + cac-unsubscribe.
- [ ] 3d. Search + content search + search-help.
- [ ] 4. Parity pass, a11y, delete leftovers, README/CLAUDE.md update.

## Port rules (added 2026-08-27)

- Do not port bugs or inefficiencies. When the Angular code is wrong, wasteful (redundant fetches, N+1, dead caches, needless re-renders), or dead, fix or drop it in the port.
- Every deliberate behaviour change goes in the Deviations list below, one line: file, what changed, why. Parity tests against prod may flag these; the list explains them.
- Cut dependencies where a native API or a few lines do the job. Justify each dependency kept in `package.json` by real use; remove anything unused.

## Deviations from Angular behaviour

- api: dead `comment.getById` / `project.getById` caches removed (never assigned, every call refetched anyway).
- api: `event.service` error bus dropped; no subscribers existed. Callers log directly.
