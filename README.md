# EaglePublic

Public web app for EPIC: React 19, Vite, TypeScript, react-router and TanStack Query. Node 24.15, Yarn 4 (Corepack).

## Documentation

All documentation has been consolidated in the [Eagle Documentation Wiki](https://github.com/bcgov/eagle-dev-guides/wiki):

* **[Architecture Overview](https://github.com/bcgov/eagle-dev-guides/wiki/Architecture-Overview)** - System components and request flow
* **[Configuration Management](https://github.com/bcgov/eagle-dev-guides/wiki/Configuration-Management)** - runtime config pattern and environment variables
* **[Deployment Pipeline](https://github.com/bcgov/eagle-dev-guides/wiki/Deployment-Pipeline)** - CI/CD workflows and procedures
* **[Local Development](https://github.com/bcgov/eagle-dev-guides/wiki/Local-Development)** - Setting up your development environment
* **[Troubleshooting](https://github.com/bcgov/eagle-dev-guides/wiki/Troubleshooting)** - Common issues and solutions

**Environments:**
- Test: https://test.projects.eao.gov.bc.ca
- Prod: https://projects.eao.gov.bc.ca

## Deployment

Test and prod serve this app as a static bundle from an Azure Storage `$web` container behind
Azure Front Door. eao-nginx (rproxy) sits in front of Front Door, so `/api` and `/admin/` stay
same-origin. There are no containers and no Helm charts.

Deploys run from a release tag, never a branch. Cut the tag first, then deploy:

```bash
gh workflow run "Create Release Tag" -f version=v1.2.3
gh workflow run "Deploy eagle-public to Azure staging" -f version=v1.2.3
gh workflow run "Deploy eagle-public to Azure production (LIVE SITE)" -f version=v1.2.3
```

Both deploy workflows reject a `version` that is not an existing tag. They rewrite `src/env.js`
for the target environment at build time, publish the bundle, purge the Front Door edge and smoke
test the result.

To roll back, re-run the deploy workflow for the previous good tag.

### Two release lines

`develop` is the release line (tags `vX.Y.Z`, the commands above). `react` is the next line
(tags `vX.0.0-beta.N`); its builds publish to the `eagle-public-next` endpoint, never to test or
prod:

```bash
gh workflow run "Create Release Tag" --ref react -f version=v3.0.0-beta.1
gh workflow run "Deploy eagle-public to Azure staging" --ref v3.0.0-beta.1 -f version=v3.0.0-beta.1 -f target=next
```

When a change earns a next line, how prod fixes flow between the lines, and the cutover steps:
[Eagle Public Release Lines](https://github.com/bcgov/eagle-dev-guides/wiki/Eagle-Public-Release-Lines).

`ACCESS_GATE: true` in `/demi-search/config` puts a password curtain over the site. It is a courtesy
screen for a not-yet-launched environment, not an access control: the unlock is a flag in the
browser's `localStorage`, and the API behind it stays open. Keep real restrictions at rproxy
(basic auth) or in eagle-api.

## Development server

This README is on the `react` branch. A fresh clone checks out `develop`, the Angular line, so
switch first. Use Node 24.15.0, the version in `.nvmrc` and `.tool-versions`.

```bash
git checkout react
corepack enable
yarn install
yarn start
```

Open `http://localhost:4200/`. The page reloads when you change a source file.

The dev server needs no local backend. It proxies these paths to test unless a variable names
another host:

| Path | Variable | Default target |
|---|---|---|
| `/demi-search` | `API_LOCATION` if set, else `DEMI_API_TARGET` | `https://demi-apim-test.azure-api.net/api`; `/demi-search/config` maps to `/api/config/public` |
| `/demi-projects` | `DEMI_API_TARGET` | `https://demi-apim-test.azure-api.net/api/projects` |
| `/demi/api` | `DEMI_API_TARGET` | `https://demi-apim-test.azure-api.net/api` |
| `/notify-api` | `NOTIFY_API_TARGET` | `https://notify-api-test.azurewebsites.net` |

To use another host, copy `.env.example` to `.env.local`, edit it, and restart `yarn start`. A
variable set in the shell wins over the file. `yarn preview` and local e2e runs use the same
targets.

| Variable | Value |
|---|---|
| `DEMI_API_TARGET` | DEMI APIM gateway or local Functions origin, no path; the proxy adds `/api` |
| `NOTIFY_API_TARGET` | eagle-notify API origin, no path |
| `API_LOCATION` | One deployed edge, such as `https://<host>`, for parity runs; its nginx adds `/api` |

Hosts for each environment are on the
[Frontend Environment Targets](https://github.com/bcgov/eagle-dev-guides/wiki/Frontend-Environment-Targets)
wiki page. You can set `API_LOCATION` in `.env.local` or the shell:
`API_LOCATION=https://<host> yarn start`. `API_LOCATION` in `src/env.js` does not change any
proxy target, and nothing proxies `/api` or `/eagle-search`.

Test has `ACCESS_GATE` on, so the site opens on the password page. To skip it, run this once in
the browser console on `http://localhost:4200/` and reload:

```js
localStorage.setItem('eagle-gate', '1');
```

The flag stays until you clear the site data.

## Building

```bash
yarn build
```

Type-checks, then writes the bundle to `dist/eagle-public/browser`. `env.js` lands there unhashed
so the deploy workflows can rewrite it per environment.

## Running unit tests

```bash
yarn test           # single run
yarn test:watch     # watch mode
yarn test:coverage  # with coverage
```

Tests run on [Vitest](https://vitest.dev/) with jsdom and Testing Library.

## Linting and formatting

```bash
yarn lint             # eslint; `any` is a warning, everything else an error
yarn format           # prettier over src, e2e and the config files
yarn format:check     # what CI runs
yarn typecheck:e2e    # tsc over e2e/, also run by CI
```

PR Checks run `lint`, `format:check`, `test`, `typecheck:e2e`, `build`, and the Playwright suite
against `vite preview` (see `e2e/README.md`).
