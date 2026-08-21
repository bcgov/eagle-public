using './main.publicprod.bicep'

// The eagle-public PRODUCTION estate. Deployed BY HAND into a NEW, EMPTY resource group in the
// c4b0a8-prod subscription (be5924ac-1083-4a1b-be92-7b444882cfd9) — never from CI, which holds no
// resource-group-scoped credential.
//
// The group name is `rg-eagle-public-prod`, settled 2026-08-17. It follows the only sibling
// application group that already exists in this subscription — `rg-condition-extractor-prod` — rather
// than the `c4b0a8-prod-networking` platform prefix, which names landing-zone infrastructure and not
// application estates. `c4b0a8-prod` is NOT empty: it holds `c4b0a8-prod-networking`,
// `NetworkWatcherRG`, `bcgov-managed-lz-live-asc-export` and `rg-condition-extractor-prod`, none of
// which are ours and none of which this template touches.
//
//   az group create -n rg-eagle-public-prod -l canadacentral \
//     --tags Project=EPIC Application=eagle-public Environment=prod ManagedBy=Bicep CostCenter=c4b0a8
//   az deployment group create -g rg-eagle-public-prod \
//     -f azure/main.publicprod.bicep -p azure/main.publicprod.bicepparam \
//
// `availabilityAlertEmail` comes from the AVAILABILITY_ALERT_EMAIL environment variable, assigned at
// the bottom of this file. DO NOT pass it as `-p availabilityAlertEmail=...` instead: az compiles a
// .bicepparam TWICE, and the first compile carries no overrides at all (azure-cli 2.89.1,
// resource/custom.py:1113 builds the template JSON, then :1125 re-runs with
// BICEP_PARAMETERS_OVERRIDES). So a parameter that is required and unassigned here fails BCP258
// before any override is applied, and no amount of `-p` rescues it. Measured: bare `bicep
// build-params` exits 1 with BCP258, the same call under BICEP_PARAMETERS_OVERRIDES exits 0.
//
// The same trap has a second edge. If the override DOES land and the variable is unset, az sends
// `availabilityAlertEmail=`, which parses as an empty string and BEATS the assignment in this file —
// producing an availability test that watches the site correctly and tells nobody, the exact failure
// the test exists to catch. Sourcing from the environment inside the file avoids both edges.
//
// The default is deliberately '' rather than absent, so that this file compiles with no environment
// at all — pr.yaml's `Compile Bicep` job builds it on every pull request with no credentials and no
// dummy values, and a required-but-unassigned parameter would fail that job forever. An empty
// address is still safe to DEPLOY: the module's `if (!empty(alertEmail))` guards drop the action
// group and the metric alert, so the test measures and stores results without notifying. That is a
// legitimate state — it is how the pre-cutover baseline gets collected before an address is agreed.
//
// What must not happen silently is APPLYING with no address once the flip is live, so that check
// lives in deploy-azure-infra-prod.yaml's Apply step, which refuses to run on an empty value. The
// forcing function moved; it did not disappear.
//
// A NEW group, not c4b0a8-prod-rg alongside anything else: this template is the whole description of
// what lives here, so a `what-if` against an empty group shows exactly the delta and nothing else's
// drift. There are no secrets in this file and there is nothing to keep out of it — the template
// declares no @secure() parameter, because a static site behind a public CDN has no credential.
//
// THIS DEPLOYMENT PUTS NOTHING ON THE REQUEST PATH. Production keeps flowing to OpenShift until
// eao-nginx's `location /` is repointed. See the template header.

param environmentName = 'prod'
param location = 'canadacentral'

// PLACEHOLDER — REPLACE BEFORE DEPLOYING. This is the object (principal) id of the user-assigned
// identity `eagle-public-cicd-prod`, which bcgov/eagle-public's deploy workflow federates into. It
// receives Storage Blob Data Contributor and Storage Account Contributor on the account this
// template creates; without it the first publish fails with 403 AuthorizationPermissionMismatch, and
// the account name is a uniqueString() so the grant cannot be made by hand in advance.
//
// The identity is NOT created by this template — modules/static-site.bicep takes the id as a plain
// string, so the identity must exist first. Create it and read the value back:
//
//   az identity create -g rg-eagle-public-prod -n eagle-public-cicd-prod -l canadacentral
//   az identity show  -g rg-eagle-public-prod -n eagle-public-cicd-prod --query principalId -o tsv
//
// The identity also needs the federated credential GitHub Actions authenticates against. The
// `--subject` MUST match the workflow's `environment:` exactly, or Azure Login fails with
// AADSTS700213 and the message does not tell you which half is wrong:
//
//   az identity federated-credential create --identity-name eagle-public-cicd-prod \
//     -g rg-eagle-public-prod -n gh-env-azure-prod \
//     --issuer https://token.actions.githubusercontent.com \
//     --subject 'repo:bcgov/eagle-public:environment:azure-prod' \
//     --audiences api://AzureADTokenExchange
//
// Yes, the identity lives in the same group this file calls "the whole description of what lives
// here". That is deliberate rather than an oversight: it is a prerequisite of this estate and
// belongs with it, and the claim above is about readable `what-if` output, not about Complete-mode
// deployment — which is never used here and would delete the identity if it were.
//
// A principal id is not a secret — it is an opaque directory reference that grants nothing on its
// own — so the real value belongs in this committed file once it exists, exactly as
// main.test.bicepparam carries test's.
//
// Set 2026-08-17 from the real `az identity create` output above. The identity's clientId is
// 1c2d4d49-4fa2-466f-a540-e922f65a6724 and the tenant is 6fdb5200-3d0d-4a8a-b036-d3685e359adc —
// those two go into the GitHub environment as AZURE_CLIENT_ID and AZURE_TENANT_ID; the principal
// (object) id below is the one ARM wants, and they are three different GUIDs for the same identity.
param publicUploaderPrincipalId = 'c4ccfeed-c1a8-426c-87cd-bcb813e2617b'

// Empty unless AVAILABILITY_ALERT_EMAIL is set in the deploying environment. See the header above
// for why this is read here rather than passed with `-p`, and why '' is a safe default to compile
// AND to deploy, but not to apply once the site is live on Azure.
param availabilityAlertEmail = readEnvironmentVariable('AVAILABILITY_ALERT_EMAIL', '')
