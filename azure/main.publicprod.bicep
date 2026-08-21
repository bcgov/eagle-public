// The eagle-public PRODUCTION estate: one storage account serving the Angular bundle out of `$web`,
// and one Front Door Standard profile in front of it. Nothing else.
//
// WHY THIS IS A SEPARATE TEMPLATE AND NOT `main.prod.bicepparam` FOR main.bicep. main.bicep deploys
// the eagle-search API web app and the AI Search service UNCONDITIONALLY — there is no flag around
// either, only around the public preview, and eagle-search production is deployed from its own root
// template into its own resource group (`azure/main.searchprod.bicep`, 2026-08-18). A prod param
// file for main.bicep would therefore stand up a search service behind a private endpoint, an App
// Service Plan to run the API on, and a Log Analytics workspace, all of them billed monthly and none
// of them serving a request. Adding a `deploySearch` flag to main.bicep to avoid that would mean
// editing the file that describes the LIVE test estate, where a mistake shows up as an outage in
// eagle-search test and in DEMI's frontend, which shares that profile. A second root template that
// consumes the same modules costs one file and risks neither.
//
// THIS ESTATE SITS DARK. Production traffic keeps flowing to OpenShift: `eao-nginx`'s `location /`
// still proxies to the eagle-public pod. Nothing here is on the request path until that one
// directive is repointed at the Front Door endpoint below — which is the cutover, and it is not this
// deployment. DNS does not move: projects.eao.gov.bc.ca keeps resolving to the OpenShift router, so
// rollback is an nginx config revert with no propagation delay to wait out.
//
// THE BUNDLE IS SAME-ORIGIN AND STAYS THAT WAY. The published prod bundle keeps relative `/api`,
// `/analytics` and `/admin/` — the Dockerfile's `API_LOCATION = null` rewrite (eagle-public
// Dockerfile ~L34) is exactly what the storage upload must reproduce. Because rproxy is still the
// public origin after cutover, those relative paths keep resolving to eagle-api and
// penguin-analytics on the SAME origin the SPA was served from. That is the whole point of the
// design: no CORS, no allowlist to maintain, no application code change, and the CSP below can say
// `connect-src 'self'` and mean it.
//
// WHAT IS DELIBERATELY ABSENT:
//   - An `/api/*` route on the profile. rproxy fronts the site, so Front Door never sees an API
//     call. Adding an origin for one now would be an untested second path to eagle-api that nothing
//     exercises — a later optional phase, if the site is ever moved out from behind rproxy.
//   - A custom domain. Same reason: the public name stays on the OpenShift router. A managed
//     certificate on an *.azurefd.net endpoint nobody resolves buys nothing.
//   - Everything eagle-search: the API app, AI Search, the extractor, Log Analytics. See above.
//   - A VNet or private endpoint. `$web` is anonymous by definition and Front Door reaches it over
//     the public internet; there is nothing here with a private data plane to protect.
//   - A consumption budget. This estate has NONE, and that is a gap rather than a solved problem.
//     (An earlier draft of this comment said DEMI's budget already covers it because it is
//     subscription-scoped. That is false: eagle-demi/azure/modules/cost-budget.bicep:82 says in its
//     own words that it targets a resource group and sees `c4b0a8-<env>-rg` only. It is also in a
//     different subscription.) The dark run rate here is small and fixed — the Front Door profile
//     base fee plus a near-empty storage account — so the cost of being wrong is bounded, but if a
//     number is wanted, cost-budget.bicep is reusable as-is and should be scoped to THIS group.

targetScope = 'resourceGroup'

@description('Target Azure region. Only canadacentral/canadaeast pass the Resource-Locations policy.')
param location string = 'canadacentral'

@description('Environment name. Names the endpoint (eagle-public-prod) and the profile (eagle-edge-prod).')
param environmentName string = 'prod'

// NO DEFAULT, unlike main.bicep's copy of this parameter. There the empty default means "test's
// preview can be stood up before CI exists"; here an empty value would deploy a storage account that
// the publish workflow cannot write to, and the failure surfaces a workflow run later as a 403
// AuthorizationPermissionMismatch rather than as a deployment error. Required, so it fails at
// submit time.
//
// The identity itself is NOT created by this template. modules/static-site.bicep takes the principal
// id as a plain string param — it does not declare the identity — so `az identity create` has to run
// FIRST and its principalId be passed in. See the .bicepparam for the exact two commands.
@description('Principal (object) id of the user-assigned identity eagle-public-cicd-prod. Created by `az identity create` BEFORE this template runs.')
param publicUploaderPrincipalId string

// NO DEFAULT, deliberately, and this is a change from how the parameter was first written. It
// carried `= ''` then, which meant a deploy that never supplied an address still succeeded and left
// behind an availability test that measured the site perfectly and notified nobody — the one
// failure this monitoring exists to catch, reproduced in the monitoring itself. Required means the
// deployment does not submit until someone has decided who gets woken up.
//
// It is a parameter rather than a literal for the original reason, which has not changed: the
// destination is an operational decision, and hardcoding one person's address into infrastructure is
// how alerts end up going to someone who left. Passing an explicit empty string is still supported
// and still deploys the test with no alerting — that is now a choice on the command line rather than
// a default nobody read.
//
// NOTHING SUPPLIES THIS YET. The .bicepparam does not set it and neither does
// `.github/workflows/deploy-azure-infra-prod.yaml`, whose `alertEmail` input was removed alongside
// the module and has not been put back. Both need the real address before this template can deploy.
@description('Address for availability alerts. Required. An explicit empty string deploys the test with no alerting.')
param availabilityAlertEmail string

// The five mandatory Cost Management tags, identical in shape to main.bicep's `defaultTags` so the
// prod estate and the test estate are comparable on a bill they share. Application is `eagle-public`
// and not `eagle-search`: nothing in this resource group belongs to the search service, and a tag
// that says otherwise makes the one cost report anyone actually reads wrong.
var defaultTags = {
  Project: 'EPIC'
  Application: 'eagle-public'
  Environment: environmentName
  ManagedBy: 'Bicep'
  CostCenter: 'c4b0a8'
}

// 1. The origin. A storage account with `$web`, `allowSharedKeyAccess: false`, and the two role
//    assignments the publish workflow needs. Static website hosting itself is turned on by the
//    workflow, not here — see that module's header for why ARM cannot do it.
//
//    NAME THE OWNER OF THAT STEP, because getting it wrong looks like a Front Door fault: the only
//    workflow that enables `$web` today is bcgov/eagle-public's `deploy-azure-staging.yaml`, and it
//    is test-only. For this estate the owner is that repo's `deploy-azure-prod.yaml`, whose first
//    run performs the enable. UNTIL THAT RUN HAPPENS, `$web` does not exist, the origin serves
//    nothing, the health probe on /index.html fails and the endpoint 404s every request. That is
//    the expected state of a freshly deployed estate, not a misconfiguration. If it ever has to be
//    done by hand:
//      az storage blob service-properties update --account-name <from the output below> \
//        --static-website --index-document index.html --404-document index.html --auth-mode login
module publicSite './modules/static-site.bicep' = {
  name: 'deploy-public-static-site'
  params: {
    location: location
    environmentName: environmentName
    tags: defaultTags
    namePrefix: 'eaglepub'
    uploaderPrincipalId: publicUploaderPrincipalId
  }
}

// The production Content-Security-Policy, ENFORCED from the first deploy rather than shipped
// report-only the way DEMI's was. That is not a shortcut: the dark window IS the report-only period.
// The site will be serving the real production bundle against real data with zero users on it, so a
// policy that breaks something breaks it in front of whoever is checking the console, not in front of
// the public. Shipping it report-only would mean a second deploy to enforce it, and that second
// deploy is the one everybody forgets.
//
// Lifted from `eaglePublicCsp` in main.bicep, with two deliberate differences, both noted inline.
var eaglePublicProdCsp = join(
  [
    'default-src \'self\' https://*.gov.bc.ca'
    // ADDED here, absent from the test policy. src/index.html:6 is `<base href="/">`, so every
    // relative URL the SPA resolves — every lazy chunk, every API call — is resolved against a tag
    // an injected script could rewrite. `base-uri 'self'` is the directive that stops that, and
    // default-src does NOT cover it: base-uri has no fallback.
    'base-uri \'self\''
    // 'unsafe-inline'/'unsafe-eval': Angular's runtime and the unpkg-hosted map libraries both need
    // them. unpkg carries Leaflet 1.9.4 and MarkerCluster 1.5.3, pinned with SRI hashes in
    // src/index.html:21-34 — the integrity attributes are what make a third-party script host
    // acceptable here, and removing unpkg means vendoring both libraries into the bundle first.
    'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https://unpkg.com'
    'style-src \'self\' \'unsafe-inline\' https://unpkg.com'
    // Blanket https:, kept from the test policy and NOT tightened. Basemap tiles come from
    // server.arcgisonline.com, and the ENGAGE banner binds an arbitrary remote image URL supplied as
    // data — there is no host list that can be written ahead of time without breaking a banner
    // somebody publishes next month. An image source list is not the part of a CSP doing security
    // work anyway.
    'img-src \'self\' data: https:'
    'font-src \'self\' data:'
    // 'self' PLUS UNPKG, AND NOTHING ELSE — the test policy's search API host is gone and no API
    // host replaces it. Prod's search API is reached through rproxy at the RELATIVE path
    // /eagle-search, and prod SEARCH_API_PATH is still empty so nothing calls it yet, and
    // every other call the bundle makes — /api to eagle-api, /analytics to penguin-analytics,
    // /api/config for env.js — is RELATIVE and therefore same-origin, because rproxy serves this
    // bundle and those backends from one hostname. That is the design, not a coincidence: the
    // moment an absolute API host appears in this directive, someone has broken same-origin and
    // signed the site up for CORS.
    //
    // unpkg is NOT here, and the deployed rule does not carry it either — this line was reconciled
    // against live on 2026-08-21. It was previously listed so DevTools could fetch unpkg's .js.map
    // source maps without logging violations, which is a developer-convenience reason to loosen the
    // one directive that governs where a page may SEND data. On a public site that trade is wrong:
    // the cost of keeping it out is console noise for whoever has DevTools open, and the cost of
    // putting it in is a third-party CDN we do not control being a permitted egress target. The
    // noise is also self-limiting — Leaflet is slated for replacement by MapLibre, which takes the
    // unpkg dependency with it. script-src and style-src still list unpkg because Leaflet genuinely
    // loads from there; those directives govern loading, not egress.
    //
    // `https://*.gov.bc.ca` IS RETAINED FROM THE TEST POLICY, deliberately, even though the design
    // above says every call is relative. The design is a statement about the bundle's DEFAULTS; the
    // running app also merges whatever `/api/config` returns over them at startup
    // (eagle-public src/app/services/config.service.ts), and the production Config document has NOT
    // been read. If it carries one absolute gov.bc.ca URL — an analytics host, a banner target — a
    // tightened connect-src turns that into a console-only failure on a live site. The wildcard adds
    // no origin that default-src does not already permit, and it costs nothing to keep. Tighten it
    // after the dark window has proven, from the console, that nothing needs it.
    'connect-src \'self\' https://*.gov.bc.ca'
    // Nothing frames eagle-public and eagle-public frames nothing — no Keycloak, no silent SSO, so
    // none of DEMI's SAMEORIGIN rationale applies here.
    'frame-ancestors \'none\''
  ],
  '; '
)

// 2. The edge. Its own profile in its own resource group — NOT the `eagle-edge-test` profile, which
//    is a different subscription's resource group and carries DEMI's frontend endpoint. One site,
//    one endpoint, one route for /*.
module frontDoor './modules/front-door.bicep' = {
  name: 'deploy-front-door'
  params: {
    environmentName: environmentName
    tags: defaultTags
    // Same principal that uploads the bundle: publishing to `$web` and purging the edge are two
    // halves of one deploy, and a principal that can do the first but not the second produces a
    // green run that changed nothing a user can see.
    purgePrincipalId: publicUploaderPrincipalId
    sites: [
      {
        name: 'eagle-public'
        // Observed, never composed: the account name is a uniqueString() and the `z13`/`z9` zone
        // number in the static-website endpoint is assigned by Azure. The module's output is the
        // only correct source, and it is the WEB endpoint, not the blob endpoint — the blob endpoint
        // returns XML listings and 404s for directory paths.
        originHostName: publicSite.outputs.webHostName
        csp: eaglePublicProdCsp
        cspReportOnly: false
        frameOptions: 'DENY'
      }
    ]
  }
}

// 3. Synthetic availability monitoring for the PUBLIC hostname. Deliberately not scoped to this
//    estate's endpoint: after cutover, rproxy stays healthy when Front Door fails, so nothing in
//    OpenShift would notice the site being down. Deployed now rather than at cutover so it watches
//    the OpenShift path first and has a baseline — the flip is approved, so the window in which
//    that baseline can still be collected is the one we are in. See the module header for what it
//    does and does not prove.
module availability './modules/availability.bicep' = {
  name: 'deploy-availability'
  params: {
    location: location
    environmentName: environmentName
    tags: defaultTags
    alertEmail: availabilityAlertEmail
  }
}

// BOTH OF THESE MUST BE READ FROM THE DEPLOYMENT OUTPUT AND NEVER COMPOSED BY HAND.
//
// The storage account name is `take('eaglepub${environmentName}${uniqueString(...)}', 24)` — the
// hash depends on the resource group id, so it is not knowable until the group exists and the
// template has run. The publish workflow needs it as an input.
//
// The endpoint host is `<name>-<hash>.<zone>.azurefd.net` and Azure assigns BOTH variable parts. The
// zone code is not the constant the docs' `z01` examples imply — the test profile's endpoints came
// back `a02`. This value is what `eao-nginx`'s `location /` proxy_pass gets pointed at on cutover
// day, so getting it from anywhere but here means pointing production at a host that does not exist.
output publicStaticStorageAccount string = publicSite.outputs.storageAccountName
output publicEdgeEndpointHostName string = frontDoor.outputs.endpointHostNames[0]
