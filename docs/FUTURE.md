# Future work

Not scheduled. Ideas with enough detail that a later session can start without re-investigating.

## Branch previews: one URL per branch, created and torn down by git alone

**Today:** one standing preview channel, `eagle-public-next`, built by hand (Bicep site, federated
credential, GitHub environment, workflow input). See the wiki page Eagle-Public-Release-Lines.
**Target:** a developer pushes `preview/<name>` and gets `https://<name>-<hash>.a02.azurefd.net`
with nothing else to do; deleting or merging the branch removes everything it created.

Precedent: the OpenShift-era `preview-branch-in-test.yaml` and `teardown-branch-preview.yaml`
(still on branch `main`) did this with one Helm release per branch. The Azure version follows the
same two-workflow shape.

Design that fits the existing estate:

- One shared storage account for previews (`eaglepreview<env>`, in eagle-edge Bicep), one origin
  group on the test Front Door profile pointing at its static website. Per-branch Front Door
  resources are created by the workflow with `az afd`, not Bicep: an endpoint named after the
  branch, a `default` route with `--origin-path /<name>` and `--patterns-to-match '/*'` so the SPA
  still serves from `/`, and an `api-passthrough` route to `og-eagle-backend` for the same
  `backendPatterns` the site routes use. Both routes attach the shared rule sets
  (`ruleseaglepublic` for headers and SPA fallback, `rulesbackend` for `/api`).
- Blobs upload to `<name>/` inside `$web`. Cache headers as in `deploy-azure-staging.yaml`.
- Create workflow: `on: push: branches: ['preview/**']`. Steps: `az afd endpoint create` (idempotent
  on rerun), the two routes, upload, purge, the existing smoke test. First creation needs the
  wait already documented: a new route serves the platform 404 for up to about 30 minutes.
- Teardown workflow: `on: delete` (branch deleted) and `on: pull_request: types: [closed]` with
  `merged == true`. Steps: `az afd endpoint delete` (removes its routes), `az storage blob
  delete-batch --pattern '<name>/*'`. Also a weekly schedule that lists endpoints and deletes any
  whose branch no longer exists, so a missed event never leaks a preview.
- Name rule: branch `preview/<name>`, `<name>` lowercase, letters, digits and hyphens, at most 20
  characters (Front Door endpoint names have limits and the hash suffix is added by Azure).
- Preview builds use the same relative `env.js` as staging (`ENVIRONMENT='test'`), so `/api` is
  same-origin on the preview hostname and shows test data, unauthenticated, as `next` does.

Blockers to clear first:

- `eagle-public-cicd-test` holds Storage roles on one account only. Endpoint and route creation
  needs `CDN Profile Contributor` on `eagle-edge-test` and Storage roles on the preview account;
  both are Bicep role assignments in eagle-edge. The ABAC rules on the subscription restrict write
  and delete by principal (see memory `reference_c4b0a8_abac_rbac` before granting).
- Resources created by `az afd` are outside Bicep. Bicep incremental deploys never delete them, so
  drift is harmless, but `what-if` output lists nothing about them. Name them with a `preview-`
  prefix so the weekly sweep and a human can tell them apart.
- `deploy-azure-staging.yaml` enforces "deploy from a tag". Previews deploy from a branch by
  design; keep that in a separate workflow so the tag rule stays intact for test and prod.
- The existing `next` channel becomes one more preview (`preview/react`) once this exists; then
  `deployNextSite`, environment `azure-next` and the `target` input can go.

## Staff mode

Let staff log into the public site instead of keeping a separate app for staff-only reads.

Mechanism: Keycloak realm `eao-epic`, a public client with check-sso and PKCE (the pattern
eagle-demi-admin uses), bearer token sent on eagle-api and demi-api reads. The backends already
gate by role: eagle-api filters on `read[]`, DEMI has RBAC. Anonymous visitors see what they see
today. A staff token unlocks unpublished projects, documents and comment periods, and staff-only
actions.

What it buys:

- Preview unpublished content in the real public layout before publishing.
- Create and repoint short URLs on the page itself instead of in DEMI Admin.
- The masthead's Staff Login becomes a login button, then an account chip. Today it is an
  external link to eagle-admin, kept as one isolated element so the swap touches one component.
- Over time, eagle-admin's read-only views can retire into it.

Cost:

- A Keycloak client per environment with the public site's redirect URIs (Front Door host and
  beta host).
- Token plumbing in `api.ts`; `/demi-search` behind APIM must accept and forward the bearer token.
- Every list and detail component gains a "staff sees more" path, so tests double for those
  screens.
- Three staff surfaces (eagle-admin, DEMI Admin, this) until something retires.

Scope for a first cut: preview plus short URLs, after the v3.0.0 cutover. Own epic, not part of
PUBLIC-166.
