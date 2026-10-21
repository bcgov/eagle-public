# Future work

Ideas with no schedule, each with enough detail to start without re-investigating.

## Branch previews

A push to `preview/<name>` creates `https://<name>-<hash>.a02.azurefd.net`. Deleting or merging the branch removes everything it created. One standing preview channel, `eagle-public-next`, is built by hand (Bicep site, federated credential, GitHub environment, workflow input; see the wiki page Eagle-Public-Release-Lines).

The OpenShift-era `preview-branch-in-test.yaml` and `teardown-branch-preview.yaml` (on branch `main`) did this with one Helm release per branch. The Azure version keeps the two-workflow shape.

Design:

- One shared storage account for previews (`eaglepreview<env>`, in eagle-edge Bicep) and one origin group on the test Front Door profile pointing at its static website.
- The workflow creates per-branch Front Door resources with `az afd`, not Bicep. Each branch gets an endpoint named after it, a `default` route with `--origin-path /<name>` and `--patterns-to-match '/*'` so the SPA serves from `/`, and an `api-passthrough` route to `og-eagle-backend` for the same `backendPatterns` as the site routes. Both routes attach the shared rule sets: `ruleseaglepublic` for headers and SPA fallback, `rulesbackend` for `/api`.
- Blobs upload to `<name>/` inside `$web`, with the cache headers from `deploy-azure-staging.yaml`.
- The create workflow runs `on: push: branches: ['preview/**']`: `az afd endpoint create` (idempotent on rerun), the two routes, upload, purge, the existing smoke test. A new route serves the platform 404 for up to about 30 minutes.
- The teardown workflow runs `on: delete` and `on: pull_request: types: [closed]` with `merged == true`: `az afd endpoint delete` (removes its routes), then `az storage blob delete-batch --pattern '<name>/*'`. A weekly schedule lists endpoints and deletes any whose branch is gone.
- `<name>` is lowercase letters, digits and hyphens, at most 20 characters, because Front Door endpoint names have limits and Azure adds the hash suffix.
- Preview builds use the same relative `env.js` as staging (`ENVIRONMENT='test'`), so `/api` is same-origin on the preview host and shows test data, unauthenticated, as `next` does.

Blockers:

- `eagle-public-cicd-test` holds Storage roles on one account only. Endpoint and route creation needs `CDN Profile Contributor` on `eagle-edge-test` and Storage roles on the preview account, both as Bicep role assignments in eagle-edge. The subscription's ABAC rules restrict write and delete by principal.
- Resources created by `az afd` are outside Bicep. Incremental deploys never delete them and `what-if` does not list them. A `preview-` name prefix lets the weekly sweep and a human tell them apart.
- `deploy-azure-staging.yaml` enforces deploy from a tag. Previews deploy from a branch, so they need a separate workflow.
- The `next` channel becomes `preview/react`; then `deployNextSite`, environment `azure-next` and the `target` input can go.

## Staff mode

Staff log into the public site instead of using a separate app for staff-only reads.

Mechanism:

- Keycloak realm `eao-epic`, a public client with check-sso and PKCE (the pattern eagle-demi-admin uses).
- A bearer token on eagle-api and demi-api reads. The backends already gate by role: eagle-api filters on `read[]`, DEMI has RBAC.
- Anonymous visitors see the same pages as before. A staff token unlocks unpublished projects, documents and comment periods, and staff-only actions.

Gains:

- Preview unpublished content in the real public layout before publishing.
- Create and repoint short URLs on the page instead of in DEMI Admin.
- The masthead gets a login button, then an account chip. Both live in one component, layout/site-header.
- eagle-admin's read-only views can retire into it.

Cost:

- A Keycloak client per environment with the public site's redirect URIs (Front Door host and beta host).
- Token plumbing in `api.ts`; `/demi-search` behind APIM must accept and forward the bearer token.
- Every list and detail component gains a "staff sees more" path, so tests double for those screens.
- Three staff surfaces (eagle-admin, DEMI Admin, this app) until one retires.

First cut: preview plus short URLs, after the v3.0.0 cutover, as its own epic.

## Design polish

- Give every map pin the contact shadow in `src/app/map/basemaps.css`, not only engaged pins; include the details-map pin.
- Cap the About masthead's inner block to the body column width, so the title and lede align with the body.
