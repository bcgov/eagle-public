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

// Proxy /search-api:
// - localhost API_LOCATION → port-forward to localhost:8108 (strip /search-api prefix)
//   Start: oc port-forward svc/typesense-typesense 8108:8108 -n 6cdc9e-dev
// - remote API_LOCATION (dev/test/prod) → route through rproxy at same host
//   No port-forward needed; eao-nginx forwards /search-api → Typesense internally
const isRemote = !target.includes('localhost') && !target.includes('127.0.0.1');
const typesenseRule = isRemote
  ? { target, secure: false, changeOrigin: true }
  : { target: 'http://localhost:8108', secure: false, changeOrigin: true, pathRewrite: { '^/search-api': '' } };

module.exports = {
  '/api':        proxyRule,
  '/analytics':  proxyRule,
  '/search-api': typesenseRule,
};
