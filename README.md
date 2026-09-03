# EaglePublic

Public web app for EPIC: React 19, Vite, TypeScript, react-router and TanStack Query. Node 24, Yarn 4 (Corepack).

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
Azure Front Door. eao-nginx (rproxy) sits in front of Front Door, so `/api`, `/analytics` and
`/admin/` stay same-origin. There are no containers and no Helm charts.

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
Fixes on `develop` not yet re-implemented here are listed in `TODO.md` under "Ports pending".

`ACCESS_GATE: true` in `/api/config` puts a password curtain over the site. It is a courtesy
screen for a not-yet-launched environment, not an access control: the unlock is a flag in the
browser's `localStorage`, and the API behind it stays open. Keep real restrictions at rproxy
(basic auth) or in eagle-api.

## Development server

```bash
yarn install
yarn start
```

Open `http://localhost:4200/`. The page reloads when you change a source file. The dev server
proxies `/api`, `/analytics`, `/eagle-search`, `/notify-api` and `/demi-search`. All but
`/notify-api` take their target from `API_LOCATION` in `src/env.js`, so change it there and
restart; `/notify-api` points at eagle-notify's test host.

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

## Linting

```bash
yarn lint
```
