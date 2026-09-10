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
  //   App then fetches runtime config from CONFIG_PATH, served by demi-search. Those values
  //   override everything below.
  //
  // ==========================================================================

  // KEEP EVERY PATH IN THIS FILE RELATIVE.
  // rproxy fronts the Azure bundle in test and prod, so `/demi-search`, `/demi-projects` and
  // `/admin/` are all same-origin locations it already serves. An absolute value baked in here
  // would follow the bundle into both environments and send those calls cross-origin.

  // false = use values below (local dev)
  // true  = fetch from CONFIG_PATH (the deploy workflows sed this at build time)
  //
  // TRUE by default now: local dev points at test, and asking test for its own config is what
  // keeps SEARCH_API_PATH out of this file — the block below says why baking one in here is
  // dangerous. Set false and fill in the values to work against something else.
  window.__env.configEndpoint = true;

  // Where the runtime config itself is fetched from, when configEndpoint is true.
  //
  // EMPTY MEANS /demi-search/config, the default that lives in src/app/config/config.ts. Set this
  // only to point a build at a config document somewhere else; changing it needs a redeploy of
  // env.js. DEMI's copy is kept current by eagle-api, which pushes its Mongo `Config` document to
  // DEMI whenever it changes, so eagle-api stays the place the values are edited.
  window.__env.CONFIG_PATH = '';

  // Log level: 0 = All, 1 = Debug, 2 = Info, 3 = Warn, 4 = Error
  window.__env.logLevel = 0;

  // Environment label
  window.__env.ENVIRONMENT = 'dev';

  // Dev proxy target — vite.config.ts reads this to route /demi-search and /demi-projects.
  // Unset, /demi-search goes to the test APIM gateway. /notify-api always has its own target.
  //
  // TEST, not dev: the Azure estate is
  // staging-and-prod rather than dev-test-prod, so test IS staging and is the only deployed
  // environment worth developing against. `configEndpoint` is true above for the same reason —
  // test's config document supplies SEARCH_API_PATH, ADMIN_PATH and the rest, so this file no
  // longer has to name any of them and cannot drift from what test actually serves.
  window.__env.API_LOCATION = 'https://eagle-test.apps.silver.devops.gov.bc.ca';

  // demi-search base — search, item reads, the access gate and document downloads all hang off it.
  //
  // EMPTY MEANS /demi-search, the default in src/app/config/config.ts. It must stay empty HERE: a
  // value baked in at build time would follow the bundle into every environment. Deployed
  // environments override it from their config document.
  //
  // IT IS A BASE PATH, NOT A HOST: `searchKeywords()` appends `search?...`, the gate appends
  // `gate`, downloads append `documents/<id>/download`. Get this wrong and every read 404s, which
  // surfaces as the toast "No data was returned from the server".
  //
  // BEFORE PROD CUTOVER: prod's config document has to carry SEARCH_API_PATH and
  // DEMI_PROJECTS_PATH, and the prod rproxy has to serve /demi-search/config, /demi-search/gate
  // and /demi-search/documents/* . The app asks eagle-api for nothing, so a prod that lacks either
  // renders the "temporarily unavailable" page rather than degrading.
  window.__env.SEARCH_API_PATH = '';

  // Document Content search tab. FALSE here and unset in prod's config document: the API answers
  // content search everywhere, but the tab stays hidden until the business signs off. Only a
  // literal true shows it, and the config document flips it with no redeploy.
  window.__env.CONTENT_SEARCH = false;

  // Shared-password curtain. Only a literal true closes it; the config document flips it with no
  // redeploy.
  window.__env.ACCESS_GATE = false;

  // eagle-admin link
  window.__env.ADMIN_PATH = 'https://eagle-test.apps.silver.devops.gov.bc.ca/admin/';

  // eagle-notify API base. The subscribe form posts to `${base}/api/subscriptions`; empty hides the
  // control. The deploy workflow seds this per environment — the config document does not carry
  // NOTIFY_API, so nothing merges over it.
  //
  // For local work set it to `/notify-api`: vite.config.ts proxies that path to the test notify API,
  // which keeps the POST same-origin so the dev server needs no CORS grant from eagle-notify.
  window.__env.NOTIFY_API = '';

  // Analytics client options. eagle-api stopped serving these three, so what ships here is what
  // the client uses; the deploy workflows sed ANALYTICS_DEBUG off.
  window.__env.ANALYTICS_DEBUG = true;
  window.__env.ANALYTICS_ENHANCED_TRACKING = true;
  window.__env.ANALYTICS_TRAFFIC_TRACKING = true;

  // eagle-analytics ingest base; the client appends /events. The deployed config document serves a
  // relative path that rproxy rewrites onto the gateway — '/api/usage' today, '/analytics' once
  // rproxy serves that location. Keep it relative and off the word analytics where ad blockers
  // matter. Empty keeps the client off, which is what local work wants.
  window.__env.EAGLE_ANALYTICS_URL = '';

  // Build hash — replaced during CI build
  window.__env.GH_HASH = 'local-build';

}(this));
