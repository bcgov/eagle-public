# EaglePublic

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.2.

## Documentation

All documentation has been consolidated in the [Eagle Documentation Wiki](https://github.com/bcgov/eagle-dev-guides/wiki):

* **[Architecture Overview](https://github.com/bcgov/eagle-dev-guides/wiki/Architecture-Overview)** - System components and request flow
* **[Configuration Management](https://github.com/bcgov/eagle-dev-guides/wiki/Configuration-Management)** - ConfigService pattern and environment variables
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

Both deploy workflows reject a `version` that is not an existing `vX.Y.Z` tag. They rewrite
`src/env.js` for the target environment at build time, publish the bundle, purge the Front Door
edge and smoke test the result.

To roll back, re-run the deploy workflow for the previous good tag.

## Development server

To start a local development server, run:

```bash
npm start
# or
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
