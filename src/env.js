(function (window) {
  window.__env = window.__env || {};

  // ==========================================================================
  // EAGLE-PUBLIC LOCAL DEVELOPMENT CONFIGURATION
  // ==========================================================================
  //
  // LOCAL DEV (configEndpoint = false):
  //   Uses these values directly. Set URLs to your local services.
  //
  // DEPLOYED (configEndpoint = true):
  //   The Dockerfile flips configEndpoint below with sed, then greps the BUILT copy to prove the
  //   rewrite took — sed exits 0 when it matches nothing. The sed is anchored on the full
  //   `window.__env.` assignment so it rewrites only that line, never these comments.
  //   App then fetches runtime config from /api/config — rproxy answers it from a ConfigMap
  //   today, eagle-api from MongoDB after the cutover.
  //   Those values override everything below.
  //
  // ==========================================================================

  // THE AZURE PREVIEW APP DOES NOT USE THIS FILE'S DEFAULTS.
  // It is served from an Azure Storage `$web` container behind Front Door — no rproxy, no
  // /api/config — so its build sets configEndpoint = false and bakes ABSOLUTE values in — API_PATH,
  // ANALYTICS_API_URL and SEARCH_API_PATH all pointing at named hosts. Do not copy that arrangement
  // back into this file: on OpenShift every one of these is either relative or supplied by the
  // ConfigMap, and an absolute value baked in here would follow the image into test and prod.
  //
  // Those three values are applied by `.github/workflows/deploy-azure-staging.yaml`, with `sed`
  // before `yarn build` — the same technique the Dockerfile already uses for the OpenShift image.
  // If you rename one of the three keys below, rename it there too: `sed` exits 0 when it matches
  // nothing, so the workflow verifies each rewrite rather than trusting it.

  // false = use values below (local dev)
  // true  = fetch from /api/config (Dockerfile sed changes this at build time)
  window.__env.configEndpoint = false;

  // Log level: 0 = All, 1 = Debug, 2 = Info, 3 = Warn, 4 = Error
  window.__env.logLevel = 0;

  // Environment label
  window.__env.ENVIRONMENT = 'dev';

  // API target — proxy.conf.js reads this to route /api and /analytics.
  // To use the dev environment: change to 'https://eagle-dev.apps.silver.devops.gov.bc.ca'
  // and set configEndpoint = true above so config is fetched from /api/config.
  window.__env.API_LOCATION = 'https://eagle-dev.apps.silver.devops.gov.bc.ca';

  window.__env.API_PATH = '/api';

  // Search backend for Project, Document and DocumentChunk (eagle-search / Azure AI Search).
  // Everything else — RecentActivity, ProjectNotification, item reads — stays on API_PATH whatever
  // this says.
  //
  // EMPTY MEANS eagle-api, and that is the kill switch: `getSearchApiPath()` falls back to
  // `getApiPath()`, so clearing it reverts search with no redeploy. Deployed environments get their
  // value from the rproxy ConfigMap at /api/config, which is why it must stay empty HERE — a value
  // baked in at build time would follow the image into test and prod, where the ConfigMap is empty
  // precisely because those environments have no search service.
  //
  // WHATEVER IT IS SET TO MUST RESOLVE TO SOMETHING ENDING IN `/api`. It is a base path, not a host:
  // `searchKeywords()` appends `search?...`, and the eagle-api fallback already ends in `/api`. On
  // OpenShift the ConfigMap supplies `/eagle-search` and nginx adds the `/api`; the Azure preview,
  // which has no nginx, bakes in the full `https://…/api`. Get this wrong and every search requests
  // `/search`, 404s, and surfaces as the toast "No data was returned from the server".
  window.__env.SEARCH_API_PATH = '';

  // eagle-admin link
  window.__env.ADMIN_PATH = 'https://eagle-dev.apps.silver.devops.gov.bc.ca/admin/';

  // Analytics — proxied through /analytics (eagle-api forwards to penguin-analytics)
  window.__env.ANALYTICS_API_URL = '/analytics';
  window.__env.ANALYTICS_DEBUG = true;
  window.__env.ANALYTICS_ENHANCED_TRACKING = true;
  window.__env.ANALYTICS_TRAFFIC_TRACKING = true;

  // Passphrase prompt in front of the whole app, for the Azure preview only. OFF here and OFF on
  // OpenShift, where rproxy's `auth_basic` already does this job at the edge.
  //
  // The Azure preview is served from blob storage `$web`, which cannot authenticate at all, so the
  // gate had to move into the bundle — which means the passphrase is readable in devtools. It is
  // obfuscation, not access control; `preview-gate.component.ts` says so at length. Both values are
  // set by `.github/workflows/deploy-azure-staging.yaml` with `sed` before `yarn build`, the
  // passphrase from a repository secret. Committed defaults stay harmless: gate off, no secret here.
  window.__env.PREVIEW_GATE = false;
  window.__env.PREVIEW_GATE_PASSPHRASE = '';

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

}(this));
