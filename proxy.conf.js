/**
 * Dev server proxy — auto-generated from src/env.js
 *
 * env.js is the single source of truth.  Change API_LOCATION there;
 * the dev server picks it up on next restart.  No need to touch this file.
 */
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const envJs = fs.readFileSync(path.join(__dirname, 'src', 'env.js'), 'utf-8');
const sandbox = { __env: {} };
vm.runInNewContext(envJs, sandbox);

const target = sandbox.__env.API_LOCATION || 'http://localhost:3000';

const proxyRule = { target, secure: false, changeOrigin: true };

module.exports = {
  '/api':       proxyRule,
  '/analytics': proxyRule,
  // `/eagle-search` too, because `SEARCH_API_PATH` from a deployed `/api/config` is RELATIVE
  // ('/eagle-search') — nginx supplies the `/api`. Without this rule every Project, Document and
  // DocumentChunk search from `ng serve` hits localhost:4200 and 404s, while everything else works,
  // which reads as "search is broken" rather than "the proxy is short a line".
  //
  // This is what makes pointing at a deployed environment sufficient. The alternative people
  // reached for — adding http://localhost:4200 to the search API's CORS allowlist — put a standing
  // cross-origin position on a live API to save this line.
  '/eagle-search': proxyRule
};
