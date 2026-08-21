// SYNTHETIC AVAILABILITY MONITORING FOR THE PUBLIC SITE.
//
// WHY THIS EXISTS AT ALL. Today `projects.eao.gov.bc.ca` is served by OpenShift pods, and if those
// die the readiness probe fails and the platform reacts. After the hosting cutover, rproxy proxies
// `location /` to the Front Door endpoint — and if Front Door or the storage account breaks, RPROXY
// IS STILL PERFECTLY HEALTHY. Its readiness probe and `/nginx_status` stay green, because nginx is
// fine; it is the upstream that is gone. The whole public site can 502 with nothing in OpenShift
// noticing. That failure mode does not exist today; the cutover creates it, and this is what closes
// it.
//
// WHY CONTENT AND NOT STATUS. For the same reason: rproxy answers. A status-only check can pass
// while the site is unusable, so the test asserts a string that only the real page body contains.
//
// WHAT THIS HONESTLY PROVES, AND WHAT IT DOES NOT. A standard availability test issues one HTTP GET
// and matches against the RESPONSE BODY. It runs no JavaScript. eagle-public is an Angular SPA, so
// the body is the shell — this proves the shell was served from a working origin through a working
// edge, NOT that the application boots, that /api/config resolved, or that any data rendered. That
// is still the difference between "the site is gone" and "the site is up", which is the alert worth
// waking someone for. A boot-level check needs a browser, and that belongs in a different tool.
//
// TARGET IS THE PUBLIC HOSTNAME, NOT THE FRONT DOOR ENDPOINT. Checking the *.azurefd.net endpoint
// would pass while the public name was broken — the thing users type is the thing to measure. It
// also means this test is valid BEFORE the cutover, watching the OpenShift path, so it has a
// baseline instead of going live at the same moment as the change it is meant to catch.

@description('Target Azure region for the workspace and the Application Insights component.')
param location string

@description('Environment name (e.g. dev, test, prod)')
param environmentName string

@description('Default resource tags')
param tags object

@description('Absolute URL to probe. The PUBLIC hostname, not the Front Door endpoint.')
param targetUrl string = 'https://projects.eao.gov.bc.ca/'

@description('String that must appear in the response body. Absence fails the test.')
param contentMatch string = '<app-root>'

// REQUIRED, WITH NO DEFAULT. It carried `= ''` when this module was first written, so a deploy that
// forgot the address still succeeded and quietly produced a test that measured everything and told
// nobody. Making it required moves that mistake from "discovered the morning the site is down" to
// "the deployment does not submit". Passing an empty string explicitly still disables alerting —
// that state is supported, it is just no longer reachable by accident.
@description('Address for availability alerts. Required. An explicit empty string deploys the test with no alerting; the test still records results.')
param alertEmail string

var workspaceName = 'eagle-public-logs-${environmentName}'
var insightsName = 'eagle-public-insights-${environmentName}'
var webTestName = 'eagle-public-availability-${environmentName}'

// Workspace-based Application Insights is the only kind that can still be created; classic was
// retired in February 2024. So the workspace is a dependency, not a choice. 30-day retention is the
// free floor and availability results are tiny — this ingests a few KB a day.
resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    // No SDK reports into this component — it exists to own the availability test. Ingestion from
    // anywhere else would be a surprise, so both public paths are closed.
    publicNetworkAccessForIngestion: 'Disabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// FIVE LOCATIONS, ALL NORTH AMERICAN. There is no Canadian probe location — the API lists 16 and
// none is in Canada, so "closest to BC" is West US. Five is Microsoft's own floor for suppressing
// false alarms: a single probe having a bad minute would otherwise page someone about a site that
// never went down. The alert below then requires two of them to fail together.
var probeLocations = [
  { Id: 'us-ca-sjc-azr' } // West US — closest to BC
  { Id: 'us-il-ch1-azr' } // North Central US
  { Id: 'us-tx-sn1-azr' } // South Central US
  { Id: 'us-va-ash-azr' } // East US
  { Id: 'us-fl-mia-edge' } // Central US
]

resource webTest 'Microsoft.Insights/webtests@2022-06-15' = {
  name: webTestName
  location: location
  tags: union(tags, {
    // REQUIRED, not decorative. Without this hidden-link tag the portal does not associate the test
    // with the component and the availability blade renders empty, which reads exactly like a test
    // that is not running.
    'hidden-link:${insights.id}': 'Resource'
  })
  kind: 'standard'
  properties: {
    SyntheticMonitorId: webTestName
    Name: webTestName
    Enabled: true
    Frequency: 300
    Timeout: 30
    Kind: 'standard'
    RetryEnabled: true
    Locations: probeLocations
    Request: {
      RequestUrl: targetUrl
      HttpVerb: 'GET'
      ParseDependentRequests: false
    }
    ValidationRules: {
      // The whole point. `ContentMatch` present and `PassIfTextFound: true` means the test fails
      // when the string is absent — which is what a Front Door outage, a storage 404 or an rproxy
      // error page all look like.
      ContentValidation: {
        ContentMatch: contentMatch
        IgnoreCase: false
        PassIfTextFound: true
      }
      // A 200 that does not contain the string is still a failure; this only adds that a non-2xx is
      // one too, without waiting for the body check.
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 14
    }
  }
}

// The address is a required parameter, but an explicitly empty one is still honoured, so the test
// can be deployed before a destination is agreed. It records results either way — what an empty
// address costs is notification, not measurement.
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (!empty(alertEmail)) {
  name: 'eagle-public-alerts-${environmentName}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'eaglepublic'
    enabled: true
    emailReceivers: [
      {
        name: 'availability'
        emailAddress: alertEmail
        // Azure's own "your alert fired" formatting rather than the raw payload.
        useCommonAlertSchema: true
      }
    ]
  }
}

// The metric alert is what turns a failed probe into a notification. Two locations, not one: a
// single probe failing is usually the probe, and paging on that trains people to ignore the alert.
resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (!empty(alertEmail)) {
  name: 'eagle-public-availability-${environmentName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'projects.eao.gov.bc.ca did not return a page containing "${contentMatch}" from two or more probe locations.'
    severity: 1
    enabled: true
    scopes: [webTest.id, insights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: webTest.id
      componentId: insights.id
      failedLocationCount: 2
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

output webTestName string = webTest.name
output insightsName string = insights.name
output alertingEnabled bool = !empty(alertEmail)
