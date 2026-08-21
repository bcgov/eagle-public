// One Front Door Standard profile in front of every static site in the resource group — the CDN half
// of the CloudFront→S3 pattern, and the only place response headers and SPA routing exist now that
// the origins are blob storage.
//
// ONE PROFILE, MANY ENDPOINTS. Sites arrive as an array of objects rather than as a second module
// instantiation, because the AFD base charge is per PROFILE: a second profile doubles a fixed cost to
// buy nothing. Adding the `/api/*` route to demi-api later is then a data change — one more element —
// not a structural one.
//
// LOCATION IS 'global', which is not a dodge of the Resource-Locations policy (enforced deny,
// CanadaCentral/CanadaEast/global only) but the only value the resource type accepts. That policy is
// also why this is Front Door and not Azure Static Web Apps: `staticSites` has no region in the
// allowed set, so SWA cannot be deployed here at all.
//
// WHAT THIS DOES NOT DO: auth. The App Service preview it replaces had a basic-auth gate in
// `server.js`. No RULE SET rule can challenge a request — the actions are rewrite and set-header,
// and that is the whole list. A WAF policy on this SKU can Block (custom rules are Standard;
// only the MANAGED rule sets are Premium), but Block is not a credential prompt. Anything that
// actually asks for one is an Entra app registration in front. What ships instead is the in-bundle
// passphrase dialog described in the README — obfuscation, not access control.

@description('Environment name (e.g. dev, test, prod)')
param environmentName string

@description('Default resource tags')
param tags object

// One object per site:
//   name            'eagle-public' — names the endpoint, origin group and rule set. Lowercase,
//                   hyphens allowed (they are stripped for the rule set, which must be alphanumeric).
//   originHostName  bare host of the storage static website endpoint, e.g. xxx.z13.web.core.windows.net
//   csp             the site's Content-Security-Policy. NOT shared: the two apps talk to different
//                   APIs, and one policy wide enough for both is wide enough for neither.
//   cspReportOnly   true emits Content-Security-Policy-Report-Only instead, for a site that has never
//                   shipped a CSP and would otherwise break on its first deploy.
//   frameOptions    optional X-Frame-Options value, default 'DENY'. Per site rather than shared
//                   because DEMI needs 'SAMEORIGIN' — see below.
// TYPED, not `array`. Untyped, the contract above was enforced nowhere: renaming `originHostName`
// to `originHostNameTypo` in the consumer compiled clean and `az bicep lint` stayed silent, so the
// PR compile gate could not catch the one mistake this shape invites. A typo would have surfaced as
// a Front Door origin pointed at nothing, after a deployment.
type siteConfig = {
  @description('Names the endpoint, origin group and rule set. Lowercase, hyphens allowed — they are stripped for the rule set, which must be alphanumeric.')
  name: string

  @description('Bare host of the storage static website endpoint, e.g. xxx.z13.web.core.windows.net')
  originHostName: string

  @description('The site\'s Content-Security-Policy. NOT shared: two apps talk to different APIs, and one policy wide enough for both is wide enough for neither.')
  csp: string

  @description('True emits Content-Security-Policy-Report-Only instead, for a site that has never shipped a CSP and would otherwise break on its first deploy.')
  cspReportOnly: bool

  @description('X-Frame-Options value, default DENY. Per site because DEMI needs SAMEORIGIN — see below.')
  frameOptions: string?
}

@description('Sites to publish.')
param sites siteConfig[]

@description('CI principal that purges the edge after a publish. Empty skips the grant.')
param purgePrincipalId string = ''

// CDN **Profile** Contributor, and the distinction is not pedantry — it cost a production deploy.
// CDN *Endpoint* Contributor grants `Microsoft.Cdn/profiles/endpoints/*`, which is CLASSIC CDN.
// Front Door Standard purges through `Microsoft.Cdn/profiles/afdEndpoints/purge/action`, a different
// resource type, so that role fails at EVERY scope. Azure reports it as `AuthorizationFailed` over
// the endpoint's resource id, which reads like a scope problem and is not one: re-granting the same
// role higher up fails identically. No built-in role is narrower for an AFD purge, so the assignment
// below is scoped to this profile alone rather than the resource group.
var cdnProfileContributorRoleId = 'ec156ff8-a8d1-4d15-830c-5b80698ca432'

var profileName = 'eagle-edge-${environmentName}'

// The four headers that are identical everywhere, lifted verbatim from the `server.js` this replaces
// (eagle-public/azure/server.js). CSP and X-Frame-Options are the other two and are appended per
// site below, because neither can be shared.
var commonHeaderActions = [
  {
    name: 'ModifyResponseHeader'
    parameters: {
      typeName: 'DeliveryRuleHeaderActionParameters'
      headerAction: 'Overwrite'
      headerName: 'Strict-Transport-Security'
      value: 'max-age=63072000; includeSubDomains; preload'
    }
  }
  {
    name: 'ModifyResponseHeader'
    parameters: {
      typeName: 'DeliveryRuleHeaderActionParameters'
      headerAction: 'Overwrite'
      headerName: 'X-Content-Type-Options'
      value: 'nosniff'
    }
  }
  {
    name: 'ModifyResponseHeader'
    parameters: {
      typeName: 'DeliveryRuleHeaderActionParameters'
      headerAction: 'Overwrite'
      headerName: 'Referrer-Policy'
      value: 'strict-origin-when-cross-origin'
    }
  }
  {
    name: 'ModifyResponseHeader'
    parameters: {
      typeName: 'DeliveryRuleHeaderActionParameters'
      headerAction: 'Overwrite'
      headerName: 'Permissions-Policy'
      // All seven directives, transcribed from the live rule. The template previously declared only
      // the first three while the deployed rule carried seven, so deploying it would have silently
      // re-enabled four Privacy Sandbox APIs. Found by a what-if diff, not by reading a header —
      // `curl -I` truncated the value mid-directive and looked like a match.
      value: 'browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()'
    }
  }
]

resource profile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: profileName
  location: 'global'
  tags: tags
  sku: { name: 'Standard_AzureFrontDoor' }
  properties: {
    // Declared because the deployed profile carries 30 and an undeclared property is a DELETED
    // property: what-if showed this being removed, which resets it to the ARM default of 60. The
    // origin is a storage account serving static files — if it has not answered in 30 seconds it is
    // not going to, and doubling the wait only lengthens the outage a user sits through.
    originResponseTimeoutSeconds: 30
  }
}

// Without this, a rebuilt estate publishes the bundle and then cannot purge, so the edge keeps
// serving the previous `index.html` and the smoke test verifies the PREVIOUS deploy and passes.
resource purgeContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(purgePrincipalId)) {
  scope: profile
  name: guid(profile.id, purgePrincipalId, cdnProfileContributorRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', cdnProfileContributorRoleId
    )
    principalId: purgePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Endpoint hostnames are `<name>-<hash>.<zone>.azurefd.net` and BOTH variable parts are assigned at
// deploy time — the zone code is not a constant either, whatever the docs' `z01` examples suggest
// (this profile's endpoints came back `a02`). So nothing anywhere may hardcode one, and nothing may
// compose one from a documented template. They come back out as outputs for exactly that reason.
@batchSize(1)
resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = [
  for site in sites: {
    parent: profile
    name: '${site.name}-${environmentName}'
    location: 'global'
    tags: tags
    properties: {
      enabledState: 'Enabled'
    }
  }
]

@batchSize(1)
resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = [
  for site in sites: {
    parent: profile
    name: 'og-${site.name}'
    properties: {
      loadBalancingSettings: {
        sampleSize: 4
        successfulSamplesRequired: 3
        additionalLatencyInMilliseconds: 50
      }
      // HEAD on the SPA shell. A single storage account has no failover partner, so this is health
      // signal for the portal rather than a routing decision.
      healthProbeSettings: {
        probePath: '/index.html'
        probeRequestType: 'HEAD'
        probeProtocol: 'Https'
        probeIntervalInSeconds: 100
      }
    }
  }
]

// originHostHeader must equal hostName. Storage routes by Host: send it anything else — an eventual
// custom domain, say — and it answers 400 for every request.
@batchSize(1)
resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = [
  for (site, i) in sites: {
    parent: originGroup[i]
    name: 'storage'
    properties: {
      hostName: site.originHostName
      originHostHeader: site.originHostName
      httpsPort: 443
      priority: 1
      weight: 1000
      enforceCertificateNameCheck: true
      enabledState: 'Enabled'
    }
  }
]

@batchSize(1)
resource ruleSet 'Microsoft.Cdn/profiles/ruleSets@2024-02-01' = [
  for site in sites: {
    parent: profile
    // Rule set names are alphanumeric only — no hyphens, unlike every other name here.
    name: 'rules${replace(site.name, '-', '')}'
  }
]

// SPA fallback. An AFD rewrite happens on the way TO the origin, so storage is asked for
// /index.html and answers 200 — which is the whole point, because storage's own
// `errorDocument404Path` serves the same bytes with a 404 status.
//
// The condition MUST be extension-based. AFD has no "only if the origin 404s" condition, so the only
// way to leave real files alone is to rewrite requests that carry no file extension: /projects/123
// gets index.html, /main.a1b2c3.js does not. `LessThanOrEqual 0` reads oddly and means "extension
// length ≤ 0", i.e. no extension.
@batchSize(1)
resource spaFallbackRule 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = [
  for (site, i) in sites: {
    parent: ruleSet[i]
    name: 'spafallback'
    properties: {
      order: 1
      conditions: [
        {
          name: 'UrlFileExtension'
          parameters: {
            typeName: 'DeliveryRuleUrlFileExtensionMatchConditionParameters'
            operator: 'LessThanOrEqual'
            matchValues: ['0']
            negateCondition: false
            transforms: []
          }
        }
      ]
      actions: [
        {
          name: 'UrlRewrite'
          parameters: {
            typeName: 'DeliveryRuleUrlRewriteActionParameters'
            sourcePattern: '/'
            destination: '/index.html'
            preserveUnmatchedPath: false
          }
        }
      ]
      matchProcessingBehavior: 'Continue' // the headers rule below still has to run
    }
  }
]

// The six headers `server.js` used to set. No conditions: they apply to every response, including
// the ones served from cache.
@batchSize(1)
resource securityHeadersRule 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = [
  for (site, i) in sites: {
    parent: ruleSet[i]
    name: 'securityheaders'
    properties: {
      order: 2
      conditions: []
      actions: concat(commonHeaderActions, [
        {
          name: 'ModifyResponseHeader'
          parameters: {
            typeName: 'DeliveryRuleHeaderActionParameters'
            headerAction: 'Overwrite'
            headerName: 'X-Frame-Options'
            // DENY for a site that frames nothing and is framed by nothing. DEMI passes SAMEORIGIN
            // and MUST KEEP IT: keycloak.init({onLoad: 'check-sso'}) does silent SSO in a hidden
            // iframe whose redirect target is the same-origin /silent-check-sso.html, and DENY
            // refuses framing even same-origin — so "hardening" this back to DENY logs every DEMI
            // user out on load, with nothing in the console but a blocked frame.
            value: site.?frameOptions ?? 'DENY'
          }
        }
        {
          name: 'ModifyResponseHeader'
          parameters: {
            typeName: 'DeliveryRuleHeaderActionParameters'
            headerAction: 'Overwrite'
            headerName: site.cspReportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
            value: site.csp
          }
        }
        {
          name: 'ModifyResponseHeader'
          parameters: {
            typeName: 'DeliveryRuleHeaderActionParameters'
            headerAction: 'Overwrite'
            // Deprecated, and modern browsers ignore it — kept only because the OpenShift pod sends
            // it today and the cutover must not drop a header the site currently carries; a scanner
            // diffing before against after would score that as a regression. Added live by hand on
            // 2026-08-21 and codified here after a what-if showed the next deployment would remove
            // it again.
            //
            // LAST, not in commonHeaderActions, purely so the array ORDER matches the deployed rule.
            // These actions are order-independent, but what-if diffs the array positionally: placing
            // it earlier reports three spurious Modify entries on every run, and a what-if that is
            // never clean is a what-if nobody reads.
            headerName: 'X-XSS-Protection'
            value: '1; mode=block'
          }
        }
      ])
    }
    // Serialised against the other rule, and the route below against both. AFD takes a lock per
    // profile: two writes to the same profile in flight at once return 409 "another operation is in
    // progress", which ARM surfaces as a failed deployment on a coin flip. Depending on the whole
    // loop symbol rather than [i] costs nothing here — there are at most two sites.
    dependsOn: [spaFallbackRule]
  }
]

@batchSize(1)
resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = [
  for (site, i) in sites: {
    parent: endpoint[i]
    name: 'default'
    properties: {
      originGroup: { id: originGroup[i].id }
      ruleSets: [{ id: ruleSet[i].id }]
      supportedProtocols: ['Http', 'Https']
      patternsToMatch: ['/*']
      forwardingProtocol: 'HttpsOnly'
      linkToDefaultDomain: 'Enabled'
      httpsRedirect: 'Enabled'
      cacheConfiguration: {
        // No `cacheBehavior` override: with a cacheConfiguration present and none set, AFD honours
        // the origin's own Cache-Control. That is deliberate — the upload sets Cache-Control per
        // blob (immutable for hashed assets, no-store for index.html and env.js), so the cache
        // policy lives with the files rather than being restated here and drifting from them.
        queryStringCachingBehavior: 'IgnoreQueryString'
        compressionSettings: {
          isCompressionEnabled: true
          contentTypesToCompress: [
            'text/html'
            'text/css'
            'text/javascript'
            'application/javascript'
            'application/json'
            'image/svg+xml'
            'font/ttf'
          ]
        }
      }
    }
    // A route whose origin group is still empty is rejected outright. The rules are here for the
    // profile lock described above, not for correctness — referencing a rule set is enough to link
    // it, but writing the route while a rule is still being written 409s.
    dependsOn: [origin, securityHeadersRule]
  }
]

output profileName string = profile.name
output endpointHostNames array = [for (site, i) in sites: endpoint[i].properties.hostName]
