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
  //   App then fetches runtime config from /demi-search/config (or CONFIG_PATH). Those values
  //   override everything below. If it cannot be loaded, the app shows an unavailable page.
  //
  // ==========================================================================

  // KEEP EVERY PATH IN THIS FILE RELATIVE.
  // rproxy fronts the Azure bundle in test and prod, so `/admin/` and the
  // search paths are all same-origin locations it already serves. An absolute value baked in here
  // would follow the bundle into both environments and send those calls cross-origin.

  // false = use values below (local dev)
  // true  = fetch from /demi-search/config (the deploy workflows sed this at build time)
  //
  // TRUE by default now: local dev points at test, and asking test for its own config is what
  // keeps SEARCH_API_PATH out of this file — the block below says why baking one in here is
  // dangerous. Set false and fill in the values to work against something else.
  window.__env.configEndpoint = true;

  // Log level: 0 = All, 1 = Debug, 2 = Info, 3 = Warn, 4 = Error
  window.__env.logLevel = 0;

  // Environment label
  window.__env.ENVIRONMENT = 'dev';

  // The app no longer calls eagle-api and reads neither line. The Azure deploy workflows rewrite
  // and assert both, so remove them only together with those checks.
  window.__env.API_LOCATION = 'https://eagle-test.apps.silver.devops.gov.bc.ca';
  window.__env.API_PATH = '/api';

  // demi-search base path for every public read. Empty means `/demi-search`; there is no eagle-api
  // fallback. Leave it empty here: a value baked in at build time would follow the bundle into
  // every environment. It is a base path, not a host: nginx (or proxy.conf.js) maps it onto
  // DEMI's `/api`, and the app appends `search?...`.
  window.__env.SEARCH_API_PATH = '';

  // Document Content search tab. FALSE here and unset in prod's runtime config: the tab stays
  // hidden until the business signs off. Only a literal true shows it, and the runtime config
  // flips it with no redeploy.
  window.__env.CONTENT_SEARCH = false;

  // Shared-password curtain. Only a literal true closes it; the runtime config flips it with no
  // redeploy.
  window.__env.ACCESS_GATE = false;

  // eagle-admin link
  window.__env.ADMIN_PATH = 'https://eagle-test.apps.silver.devops.gov.bc.ca/admin/';

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

}(this));
