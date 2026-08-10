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
  //   Dockerfile runs: sed -i 's/configEndpoint = false/configEndpoint = true/'
  //   App then fetches runtime config from /api/config (nginx ConfigMap).
  //   Those values override everything below.
  //
  // ==========================================================================

  // THE AZURE PREVIEW APP DOES NOT USE THIS FILE'S DEFAULTS.
  // `eagle-public-preview-dev` is a static Azure App Service with no rproxy and no /api/config, so
  // its build sets configEndpoint = false and bakes ABSOLUTE values in — API_PATH,
  // ANALYTICS_API_URL and SEARCH_API_PATH all pointing at named hosts. Do not copy that arrangement
  // back into this file: on OpenShift every one of these is either relative or supplied by the
  // ConfigMap, and an absolute value baked in here would follow the image into test and prod.

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

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

}(this));
