'use strict';

/**
 * Static server for the Azure App Service preview of eagle-public.
 *
 * BRANCH `azure-search-preview` — not part of the OpenShift deployment, which serves the same
 * bundle from nginx inside the container image (see the `Dockerfile` heredoc).
 *
 * WHY NOT `pm2 serve --spa`, which is what eagle-demi's frontend uses: it sets no response headers
 * at all. The OpenShift image sets six — CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
 * Referrer-Policy and Permissions-Policy — and quietly dropping all of them from a public site is
 * not a corner worth cutting for convenience. They are reproduced below.
 *
 * WHY NO DEPENDENCIES: `node:http` and `node:fs` do the whole job. eagle-public is an Angular app
 * and has no server-side dependency today; adding express so a preview can serve files would put a
 * production dependency in `package.json` for something only this branch uses.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'browser');
const PORT = process.env.PORT || 8080;

/**
 * `connect-src` differs from the OpenShift copy, and that difference is the whole point of this
 * deployment: the browser now talks to eagle-api on OpenShift AND eagle-search on Azure. Both are
 * named explicitly rather than wildcarding `*.azurewebsites.net`, which would let this page reach
 * every Azure web app in existence.
 */
/**
 * Leaflet and its marker-cluster plugin are loaded from unpkg by `index.html` — they are not npm
 * dependencies of this app, only their `@types` are. Omitting this origin blocks both, `L` comes out
 * undefined, and the whole SPA dies on a white screen with nothing but a CSP violation in the
 * console.
 *
 * This was not caught by copying the OpenShift policy because that policy is never applied: the
 * dev site behind rproxy returns no `Content-Security-Policy` header at all, so its `add_header` in
 * the Dockerfile has never actually constrained anything. Self-hosting Leaflet would let this go —
 * it also removes a third-party CDN from a government page — but that is a change to the shared app,
 * not to this preview.
 */
const CDN = 'https://unpkg.com';

const CSP = [
  "default-src 'self' https://*.gov.bc.ca",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CDN}`,
  `style-src 'self' 'unsafe-inline' ${CDN}`,
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.gov.bc.ca https://eagle-search-api-dev.azurewebsites.net",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'browsing-topics=(), run-ad-auction=(), join-ad-interest-group=()',
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Angular emits content-hashed filenames, so those are safe to cache hard. Nothing else is. */
function cacheFor(file) {
  if (/\/env\.js$/.test(file)) return 'no-cache, no-store, must-revalidate'; // runtime config
  if (/\.(html|json)$/.test(file)) return 'no-cache, no-store, must-revalidate';
  if (/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/.test(file)) return 'public, max-age=31536000, immutable';
  return 'no-cache';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') return send(res, 200, 'healthy', { 'Content-Type': 'text/plain' });

  // Resolve inside ROOT and verify it stayed there: `..` in a request path is a directory
  // traversal, and this process can read the whole filesystem.
  const requested = path.join(ROOT, decodeURIComponent(url.pathname));
  const resolved = path.resolve(requested);
  if (!resolved.startsWith(path.resolve(ROOT))) return send(res, 403, 'forbidden', { 'Content-Type': 'text/plain' });

  fs.stat(resolved, (err, stat) => {
    // SPA fallback: anything that is not a real file is a client-side route, so serve index.html
    // and let Angular's router decide. A 404 here would break every deep link.
    const file = err || stat.isDirectory() ? path.join(ROOT, 'index.html') : resolved;
    fs.readFile(file, (readErr, data) => {
      if (readErr) return send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
      send(res, 200, data, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': cacheFor(file),
      });
    });
  });
});

server.listen(PORT, () => console.log(`eagle-public preview listening on ${PORT}, serving ${ROOT}`));
