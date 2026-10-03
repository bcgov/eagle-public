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

// The APIM gateway nginx itself proxies to for both DEMI paths. It answers anonymously, while
// test's site answers them with `401 WWW-Authenticate: Basic`, so they do NOT follow API_LOCATION.
const demiGateway = 'https://demi-apim-test.azure-api.net';

module.exports = {
  '/api':       proxyRule,
  // Phase dates for the assessment rail. Nothing here supplies nginx's `/api/projects` prefix.
  '/demi-projects': {
    target: demiGateway,
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/demi-projects': '/api/projects' }
  },
  // Every public read. The base path is `/demi-search` because nginx supplies the `/api`.
  '/demi-search': {
    target: demiGateway,
    secure: false,
    changeOrigin: true,
    // First match wins. `/config` is the one path nginx does not map straight through: it answers
    // `/api/config/public`. `/api/config` is DEMI's internal one, with no ACCESS_GATE, so booting
    // on it fails the whole-payload check.
    pathRewrite: {
      '^/demi-search/config(?=$|[?#])': '/api/config/public',
      '^/demi-search': '/api'
    }
  }
};
