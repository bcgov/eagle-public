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

// Proxy /search-api to a local Typesense port-forward (local dev only).
// In production, /search-api is handled by the eao-nginx rproxy.
// Start port-forward: oc port-forward svc/typesense-typesense 8108:8108 -n 6cdc9e-dev
const typesenseLocal = { target: 'http://localhost:8108', secure: false, changeOrigin: true,
  pathRewrite: { '^/search-api': '' } };

module.exports = {
  '/api':        proxyRule,
  '/analytics':  proxyRule,
  '/search-api': typesenseLocal,
};
