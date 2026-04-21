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

// Typesense proxy — routes /search-api to the target set by TYPESENSE_API_LOCATION.
//
// TYPESENSE_API_LOCATION options (set in src/env.js):
//   dev  (default): https://eagle-dev.apps.silver.devops.gov.bc.ca
//   test:           https://eagle-test.apps.silver.devops.gov.bc.ca
//   prod:           https://projects.eao.gov.bc.ca
//   port-forward:   http://localhost:8108  (legacy — still works, strips /search-api prefix)
//
// eao-nginx exposes /search-api/ without HTTP basic auth on all three environments.
// No port-forward needed when using a remote TYPESENSE_API_LOCATION.
const tsTarget = sandbox.__env.TYPESENSE_API_LOCATION || target;
const isDirectTypesense = tsTarget.includes('localhost') || tsTarget.includes('127.0.0.1');
const typesenseRule = isDirectTypesense
  ? { target: tsTarget, secure: false, changeOrigin: true, pathRewrite: { '^/search-api': '' } }
  : { target: tsTarget, secure: false, changeOrigin: true };

module.exports = {
  '/api':        proxyRule,
  '/analytics':  proxyRule,
  '/search-api': typesenseRule,
};
