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

  // false = use values below (local dev)
  // true  = fetch from /api/config (Dockerfile sed changes this at build time)
  window.__env.configEndpoint = false;

  // Log level: 0 = All, 1 = Debug, 2 = Info, 3 = Warn, 4 = Error
  window.__env.logLevel = 0;

  // Environment label
  window.__env.ENVIRONMENT = 'local';

  // API target — proxy.conf.js reads this to route /api and /analytics.
  window.__env.API_LOCATION = 'https://eagle-test.apps.silver.devops.gov.bc.ca';
  window.__env.API_PATH = '/api';

  // eagle-admin link
  window.__env.ADMIN_PATH = 'http://localhost:4200/admin/';

  // Analytics — proxied through /analytics (eagle-api forwards to penguin-analytics)
  window.__env.ANALYTICS_API_URL = '/analytics';
  window.__env.ANALYTICS_DEBUG = true;
  window.__env.ANALYTICS_ENHANCED_TRACKING = true;
  window.__env.ANALYTICS_TRAFFIC_TRACKING = true;

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

  // Typesense search — all queries proxy through eagle-api (/api/public/typesense/*).
  // No API key needed in the browser; eagle-api injects role filter server-side.

}(this));
