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

  // ==========================================================================
  // BRANCH `azure-search-preview` — NOT FOR MERGE AS-IS
  // ==========================================================================
  // This branch is deployed to an Azure App Service (eagle-public-preview-dev) to try the
  // Azure-hosted end state, so every value below is ABSOLUTE and baked in at build time. There is
  // no /api/config to fetch on that host and no rproxy in front of it, so the usual
  // "relative paths, config from the API" arrangement does not apply.
  //
  // Before merging to develop: revert configEndpoint to true's build-time sed, put API_PATH and
  // ANALYTICS_API_URL back to relative, and move SEARCH_API_PATH into the nginx ConfigMap so it is
  // per-environment rather than compiled in.
  // ==========================================================================

  // false = use values below (local dev)
  // true  = fetch from /api/config (Dockerfile sed changes this at build time)
  //
  // FALSE on this branch even when deployed: the Azure host serves static files only and has no
  // /api/config to proxy, so a fetch would fail and leave every value below standing anyway.
  window.__env.configEndpoint = false;

  // Log level: 0 = All, 1 = Debug, 2 = Info, 3 = Warn, 4 = Error
  window.__env.logLevel = 0;

  // Environment label
  window.__env.ENVIRONMENT = 'dev';

  // API target — proxy.conf.js reads this to route /api and /analytics.
  // To use the dev environment: change to 'https://eagle-dev.apps.silver.devops.gov.bc.ca'
  // and set configEndpoint = true above so config is fetched from /api/config.
  window.__env.API_LOCATION = 'https://eagle-dev.apps.silver.devops.gov.bc.ca';

  // ABSOLUTE on this branch. getApiPath() returns `API_PATH || '/api'`, so an absolute value makes
  // every call absolute with no code change. eagle-api already answers cross-origin — verified: an
  // arbitrary Azure origin gets `access-control-allow-origin: *` (app.js:44-70) — and eagle-public
  // is anonymous, so `*` is sufficient.
  window.__env.API_PATH = 'https://eagle-dev.apps.silver.devops.gov.bc.ca/api';

  // Search backend for Project, Document and DocumentChunk (eagle-search / Azure AI Search).
  // Absolute, because it is a different origin — unlike API_PATH it cannot be relative.
  //
  // EMPTY MEANS eagle-api, and that is the kill switch: clear it and search reverts with no
  // redeploy. Everything else (RecentActivity, ProjectNotification, item reads) stays on API_PATH
  // regardless.
  //   dev: 'https://eagle-search-api-dev.azurewebsites.net'
  window.__env.SEARCH_API_PATH = 'https://eagle-search-api-dev.azurewebsites.net';

  // eagle-admin link
  window.__env.ADMIN_PATH = 'https://eagle-dev.apps.silver.devops.gov.bc.ca/admin/';

  // Analytics — absolute on this branch, same reason as API_PATH. Cross-origin analytics is
  // unverified and its failure is non-fatal: the plugin swallows the error, so a blocked request
  // costs telemetry, not function.
  window.__env.ANALYTICS_API_URL = 'https://eagle-dev.apps.silver.devops.gov.bc.ca/analytics';
  window.__env.ANALYTICS_DEBUG = true;
  window.__env.ANALYTICS_ENHANCED_TRACKING = true;
  window.__env.ANALYTICS_TRAFFIC_TRACKING = true;

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

}(this));
