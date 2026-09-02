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
  //   The Azure deploy workflows flip configEndpoint below with sed, then grep the BUILT copy to
  //   prove the rewrite took — sed exits 0 when it matches nothing. The sed is anchored on the full
  //   `window.__env.` assignment so it rewrites only that line, never these comments.
  //   App then fetches runtime config from /api/config, served by eagle-api from its Mongo
  //   `Config` document. Those values override everything below.
  //
  // ==========================================================================

  // KEEP EVERY PATH IN THIS FILE RELATIVE.
  // rproxy fronts the Azure bundle in test and prod, so `/api`, `/analytics`, `/admin/` and the
  // search paths are all same-origin locations it already serves. An absolute value baked in here
  // would follow the bundle into both environments and send those calls cross-origin.

  // false = use values below (local dev)
  // true  = fetch from /api/config (the deploy workflows sed this at build time)
  //
  // TRUE by default now: local dev points at test, and asking test for its own config is what
  // keeps SEARCH_API_PATH out of this file — the block below says why baking one in here is
  // dangerous. Set false and fill in the values to work against something else.
  window.__env.configEndpoint = true;

  // Log level: 0 = All, 1 = Debug, 2 = Info, 3 = Warn, 4 = Error
  window.__env.logLevel = 0;

  // Environment label
  window.__env.ENVIRONMENT = 'dev';

  // API target — proxy.conf.js reads this to route /api, /analytics and /demi-search.
  //
  // TEST, not dev: the Azure estate is
  // staging-and-prod rather than dev-test-prod, so test IS staging and is the only deployed
  // environment worth developing against. `configEndpoint` is true above for the same reason —
  // test's /api/config supplies SEARCH_API_PATH, ADMIN_PATH and the rest, so this file no longer
  // has to name any of them and cannot drift from what test actually serves.
  window.__env.API_LOCATION = 'https://eagle-test.apps.silver.devops.gov.bc.ca';

  window.__env.API_PATH = '/api';

  // Search backend for Project, Document and DocumentChunk (eagle-search / Azure AI Search).
  // Everything else — RecentActivity, ProjectNotification, item reads — stays on API_PATH whatever
  // this says.
  //
  // EMPTY MEANS eagle-api, and that is the kill switch: `getSearchApiPath()` falls back to
  // `getApiPath()`, so clearing it reverts search with no redeploy. Deployed environments get their
  // value from /api/config, which is why it must stay empty HERE — a value baked in at build time
  // would follow the bundle into every environment. Test serves `/eagle-search` from eagle-api's
  // Mongo `Config` document; prod's is still empty, which is why prod search still comes from
  // eagle-api even though the prod search estate exists and is indexed.
  //
  // WHATEVER IT IS SET TO MUST RESOLVE TO SOMETHING ENDING IN `/api`. It is a base path, not a host:
  // `searchKeywords()` appends `search?...`, and the eagle-api fallback already ends in `/api`.
  // `/api/config` supplies `/eagle-search` and rproxy adds the `/api`. Get this wrong and every
  // search requests `/search`, 404s, and surfaces as the toast "No data was returned from the
  // server".
  window.__env.SEARCH_API_PATH = '';

  // Document Content search tab. FALSE here and unset in prod's /api/config: the API answers
  // content search everywhere, but the tab stays hidden until the business signs off. Only a
  // literal true shows it, and /api/config flips it with no redeploy.
  window.__env.CONTENT_SEARCH = false;

  // Shared-password curtain. Only a literal true closes it; /api/config flips it with no redeploy.
  window.__env.ACCESS_GATE = false;

  // eagle-admin link
  window.__env.ADMIN_PATH = 'https://eagle-test.apps.silver.devops.gov.bc.ca/admin/';

  // eagle-notify site base. Empty hides the subscribe links. The deploy workflow seds this per
  // environment — eagle-api does not serve NOTIFY_URL, so /api/config never merges over it.
  window.__env.NOTIFY_URL = '';

  // Analytics — proxied through /analytics (eagle-api forwards to penguin-analytics)
  window.__env.ANALYTICS_API_URL = '/analytics';
  window.__env.ANALYTICS_DEBUG = true;
  window.__env.ANALYTICS_ENHANCED_TRACKING = true;
  window.__env.ANALYTICS_TRAFFIC_TRACKING = true;

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

}(this));
