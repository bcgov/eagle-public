(function (window) {
  window.__env = window.__env || {};

  // ==========================================================================
  // EAGLE-PUBLIC ENVIRONMENT CONFIGURATION
  // ==========================================================================
  // 
  // LOCAL DEV (configEndpoint = false):
  //   - Uses values below directly
  //   - Hits APIs directly (no proxy)
  //
  // DEPLOYED (configEndpoint = true):
  //   - Dockerfile runs: sed -i 's/configEndpoint = false/configEndpoint = true/' src/env.js
  //   - App fetches runtime config from /api/config
  //   - API config values override these defaults
  //
  // ==========================================================================

  // Log level: 0 = All, 1 = Debug, 2 = Info, 3 = Warn, 4 = Error
  window.__env.logLevel = 0;

  // Get config from remote host?
  // LOCAL: false (use values below)
  // DEPLOYED: true (Dockerfile changes this via sed, then app fetches from /api/config)
  window.__env.configEndpoint = false;

  // Environment name - for display purposes
  window.__env.ENVIRONMENT = 'local';

  // API configuration - full URL for local dev
  // NOTE: eagle-api must have CORS configured to allow localhost:4200
  window.__env.API_LOCATION = 'https://eagle-dev.apps.silver.devops.gov.bc.ca';
  window.__env.API_PATH = '/api';

  // Admin app URL (for links)
  window.__env.ADMIN_PATH = 'http://localhost:4200/admin/';

  // Analytics configuration
  // LOCAL: /api/analytics - proxy rewrites to localhost:3001/analytics
  // DEPLOYED: fetched from /api/config (points to penguin-analytics service URL)
  window.__env.ANALYTICS_API_URL = '/api/analytics';
  window.__env.ANALYTICS_DEBUG = true;

  // Build hash - replaced during CI build (not used in local dev)
  window.__env.GH_HASH = 'local-build';

}(this));
