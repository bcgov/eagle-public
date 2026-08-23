// A storage account serving an Angular bundle from its `$web` container — the origin half of the
// CloudFront→S3 pattern. Instantiated twice: the eagle-public preview here, and DEMI's frontend from
// `eagle-demi`'s template.
//
// WHY THIS REPLACED AN APP SERVICE. `eagle-public-preview-*` was a B1 Linux worker running a
// hand-written `node server.js` whose entire job was to read files off disk and set six response
// headers. Blob storage reads files off disk for a fraction of a cent, and Front Door sets the
// headers. What is lost is exactly what the App Service was for and nothing else.
//
// WHAT STORAGE CANNOT DO, and why there is a Front Door in front of it:
//   - no response headers. `$web` returns Content-Type and the blob's own Cache-Control, nothing else.
//     The six security headers come from the AFD rule set.
//   - no auth of any kind. `$web` is anonymous by definition.
//   - no SPA fallback with a 200. See `errorDocument404Path` below.
//
// `allowBlobPublicAccess: false` and a public `$web` are NOT in conflict, which is the one thing
// about this that reads wrong. That flag governs *container* public-access level; the static website
// endpoint is a separate, always-anonymous endpoint that the flag does not reach. It has to be
// exactly false — policy `Deny-Storage-Public-Access` is an enforced deny, not an audit.

@description('Azure region. Only canadacentral/canadaeast pass the Resource-Locations policy.')
param location string = resourceGroup().location

@description('Environment name (e.g. dev, test, prod)')
param environmentName string

@description('Default resource tags')
param tags object

@description('Short lowercase prefix for the account name, e.g. eaglepub. Letters only — see below.')
param namePrefix string

@description('Principal id that publishes the bundle — the CI identity (eagle-public-cicd-<env>). Empty grants nobody, and `az storage blob upload-batch --auth-mode login` then fails with 403.')
param uploaderPrincipalId string = ''

// Storage account names are globally unique, lowercase alphanumeric, and capped at 24 characters —
// the same reason `extractor.bicep` hashes its name rather than spelling one out.
var storageName = take('${namePrefix}${environmentName}${uniqueString(resourceGroup().id)}', 24)

// TWO roles, because the publish workflow makes two different kinds of call and neither role
// covers the other. Both are granted here rather than by hand because the account name comes out
// of uniqueString() and does not exist until this template has run.
//
// Storage Blob Data Contributor — the DATA plane, `az storage blob upload-batch --auth-mode login`.
// The CI identity's Website Contributor grant was enough for the App Service this replaces and
// grants nothing at all on storage, so without this the publish 403s with
// AuthorizationPermissionMismatch.
var blobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// Storage Account Contributor — the CONTROL plane, for
// `az storage blob service-properties update --static-website`, which needs
// Microsoft.Storage/storageAccounts/blobServices/write. That is a management action with no
// dataAction behind it, so Blob Data Contributor above does NOT grant it: the workflow's very
// first storage step fails with AuthorizationFailed, before a single blob is uploaded.
//
// IT IS BROADER THAN IT LOOKS, AND THE MITIGATION BELOW DOES NOT CONTAIN IT. An earlier version of
// this comment argued that `allowSharedKeyAccess: false` makes the keys listKeys hands out unusable,
// so the grant reduces to what it needs. That is false: the role's action list is
// `Microsoft.Storage/storageAccounts/*`, which carries `write` as well as `listKeys/action`, so the
// same principal can PATCH `allowSharedKeyAccess` back to true and then listKeys returns working
// credentials. A control the grant can itself undo is not a control.
//
// It is kept anyway, deliberately. The principal already holds Blob Data Contributor on this same
// account (above), so the path reaches no data it cannot already read and write — the real delta is
// a long-lived bearer key that would survive outside the OIDC federation and outside any future
// conditional-access or audit story, not an escalation.
//
// The tighter fix is a custom role carrying only `Microsoft.Storage/storageAccounts/blobServices/write`,
// which is the single control-plane action the `$web` enable actually needs. Not done here: a custom
// role definition is subscription-scoped and needs privileges this template's deployer does not have.
var storageAccountContributorRoleId = '17d1049b-9a84-46fb-8f53-869881c3d3ab'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2' // BlobStorage/BlockBlobStorage have no static website endpoint.
  properties: {
    // All three are policy-enforced denies in bcgov-managed-lz-live, not preferences:
    // Deny-Storage-Public-Access, Deny-Storage-http, Enforce-TLS-SSL-Q225.
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    // Entra only. Every writer authenticates with `--auth-mode login` (CI via OIDC), so account keys
    // are dead weight — and turning them off is what makes the Storage Account Contributor grant
    // above acceptable, since its listKeys then returns credentials that cannot authenticate. Also
    // satisfies the landing-zone guardrail `deny-storage-shared-key`, assigned DoNotEnforce today.
    allowSharedKeyAccess: false
  }
}

resource uploaderBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(uploaderPrincipalId)) {
  scope: storage
  name: guid(storage.id, uploaderPrincipalId, blobDataContributorRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', blobDataContributorRoleId
    )
    principalId: uploaderPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource uploaderAccountContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(uploaderPrincipalId)) {
  scope: storage
  name: guid(storage.id, uploaderPrincipalId, storageAccountContributorRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', storageAccountContributorRoleId
    )
    principalId: uploaderPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// STATIC WEBSITE IS NOT DECLARED HERE, and that is not an omission. `staticWebsite` is a blob
// *data-plane* setting; ARM's `Microsoft.Storage/storageAccounts/blobServices` schema has no such
// property, and writing one anyway compiles to a template that deploys cleanly and silently leaves
// `$web` disabled. What turns it on is the "Enable static website hosting on $web" step in
// bcgov/eagle-public's `deploy-azure-staging.yaml` — idempotent, so it runs on every deploy and is
// a no-op after the first. That is why the CI identity needs Storage Account Contributor above and
// not just the data-plane role. Run by hand only when publishing without that workflow:
//
//   az storage blob service-properties update --account-name <name> --auth-mode login \
//     --static-website --index-document index.html --404-document index.html
//
// `--404-document index.html` is belt and braces only: it serves the SPA shell but with a **404
// status**, which breaks deep links for anything that reads the status (crawlers, uptime checks).
// The real fallback is the Front Door rewrite, which reaches the origin as a request for
// /index.html and therefore returns 200.

output storageAccountName string = storage.name
output storageAccountId string = storage.id

// Front Door wants a bare host, not a URL: primaryEndpoints.web is
// 'https://<account>.z13.web.core.windows.net/' and the zone number is assigned by Azure, so this
// cannot be spelled out by hand either.
output webHostName string = replace(replace(storage.properties.primaryEndpoints.web, 'https://', ''), '/', '')
