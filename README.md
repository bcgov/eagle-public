# eagle-public

Public-facing Angular app for [EPIC](https://projects.eao.gov.bc.ca/) (Environmental Assessment Information and Collaboration). Citizens view EA projects, submit comments, and access public documents.

## Quick Start

**Prerequisites:** Node.js 24.x, Yarn 4.12.0 (via Corepack)

```bash
corepack enable
yarn install
yarn start        # http://localhost:4200
```

By default, `src/env.js` proxies `/api` and `/analytics` to the **test** environment. To use a local eagle-api instead, update `API_LOCATION` in `src/env.js`:

```javascript
window.__env.API_LOCATION = 'http://localhost:3000';
```

Restart the dev server — `proxy.conf.js` picks up the change automatically. Do **not** edit `proxy.conf.js` directly.

## Commands

| Command | Description |
|---------|-------------|
| `yarn start` | Dev server with hot reload (localhost:4200) |
| `yarn build` | Production build to `dist/` |
| `yarn test` | Run unit tests (Vitest) |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:coverage` | Run tests with coverage report |
| `yarn lint` | ESLint check |

## Environments

| Environment | URL |
|-------------|-----|
| Dev | https://eagle-dev.apps.silver.devops.gov.bc.ca |
| Test | https://eagle-test.apps.silver.devops.gov.bc.ca |
| Prod | https://projects.eao.gov.bc.ca |

## Documentation

Full docs in the [Eagle Dev Guides Wiki](https://github.com/bcgov/eagle-dev-guides/wiki):

- [Local Development](https://github.com/bcgov/eagle-dev-guides/wiki/Local-Development) — Setup guide for all EPIC apps
- [Architecture Overview](https://github.com/bcgov/eagle-dev-guides/wiki/Architecture-Overview) — System components and request flow
- [Configuration Management](https://github.com/bcgov/eagle-dev-guides/wiki/Configuration-Management) — ConfigService and env.js pattern
- [Deployment Pipeline](https://github.com/bcgov/eagle-dev-guides/wiki/Deployment-Pipeline) — CI/CD workflows
- [Troubleshooting](https://github.com/bcgov/eagle-dev-guides/wiki/Troubleshooting) — Common issues
