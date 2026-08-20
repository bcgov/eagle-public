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
  //   App then fetches runtime config from /api/config — in dev and test that is already eagle-api
  //   reading its Mongo `Config` document; prod still gets it from the rproxy ConfigMap until prod
  //   moves to rproxy v2.7.11, which is the image that swaps the source.
  //   Those values override everything below.
  //
  // ==========================================================================

  // THE AZURE STATIC SITES DO NOT USE THIS FILE'S DEFAULTS.
  // `eagle-public-test` and `eagle-public-prod` are blob-storage origins behind Front Door — no App
  // Service, no rproxy, and nothing serving /api/config — so the test build sets
  // configEndpoint = false and bakes ABSOLUTE values in: API_PATH, ANALYTICS_API_URL and
  // SEARCH_API_PATH all pointing at named hosts. (The prod build leaves configEndpoint = true, so it
  // asks its own origin for /api/config and gets index.html back; it is not in use.) Do not copy
  // back into this file: on OpenShift every one of these is either relative or supplied at runtime
  // by /api/config, and an absolute value baked in here would follow the image into test and prod.

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
  // value from /api/config, which is why it must stay empty HERE — a value baked in at build time
  // would follow the image into every environment. Test serves `/eagle-search` from eagle-api's
  // Mongo `Config` document; prod's is still empty, which is why prod search still comes from
  // eagle-api even though the prod search estate exists and is indexed.
  //
  // WHATEVER IT IS SET TO MUST RESOLVE TO SOMETHING ENDING IN `/api`. It is a base path, not a host:
  // `searchKeywords()` appends `search?...`, and the eagle-api fallback already ends in `/api`. On
  // OpenShift `/api/config` supplies `/eagle-search` and nginx adds the `/api`; the Azure static
  // sites, which have no nginx, bake in the full `https://…/api`. Get this wrong and every
  // search requests `/search`, 404s, and surfaces as the toast "No data was returned from the
  // server".
  window.__env.SEARCH_API_PATH = '';

  // eagle-admin link
  window.__env.ADMIN_PATH = 'https://eagle-dev.apps.silver.devops.gov.bc.ca/admin/';

  // Analytics — proxied through /analytics (eagle-api forwards to penguin-analytics)
  window.__env.ANALYTICS_API_URL = '/analytics';
  window.__env.ANALYTICS_DEBUG = true;
  window.__env.ANALYTICS_ENHANCED_TRACKING = true;
  window.__env.ANALYTICS_TRAFFIC_TRACKING = true;

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

}(this));
