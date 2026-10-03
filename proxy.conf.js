/**
 * Dev server proxy for the two DEMI paths the app reads from.
 */

// The APIM gateway nginx itself proxies to for both DEMI paths. It answers anonymously, while
// test's site answers them with `401 WWW-Authenticate: Basic`, so they go to the gateway directly.
const demiGateway = 'https://demi-apim-test.azure-api.net';

module.exports = {
  // Single project reads; rewritten onto DEMI's /api/projects.
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
