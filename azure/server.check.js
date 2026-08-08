'use strict';

/**
 * Self-check for the Azure preview static server. `node azure/server.check.js`
 *
 * Two things here are worth a test rather than a read-through: the directory-traversal guard, which
 * protects a process that can read the whole filesystem, and the SPA fallback, whose absence breaks
 * every deep link while the home page keeps working — so it looks fine until someone shares a URL.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = 8123;
const base = `http://127.0.0.1:${PORT}`;

// A throwaway bundle. `browser/` matches what `yarn build` emits under dist/eagle-public.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-public-preview-'));
fs.mkdirSync(path.join(tmp, 'browser'));
fs.writeFileSync(path.join(tmp, 'browser', 'index.html'), '<html>index</html>');
fs.writeFileSync(path.join(tmp, 'browser', 'main.css'), 'body{}');
fs.copyFileSync(path.join(__dirname, 'server.js'), path.join(tmp, 'server.js'));

const child = spawn(process.execPath, [path.join(tmp, 'server.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

const cleanup = () => {
  child.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
};

(async () => {
  // Wait for listen rather than sleeping a fixed amount.
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${base}/health`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  assert.strictEqual(await (await fetch(`${base}/health`)).text(), 'healthy');

  const index = await fetch(`${base}/`);
  assert.strictEqual(index.status, 200);

  // Every security header the OpenShift nginx sets must be present — `pm2 serve`, the obvious
  // alternative, sets none of them.
  for (const h of [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
    'permissions-policy',
  ]) {
    assert.ok(index.headers.get(h), `missing ${h}`);
  }
  // The Azure search host must be reachable from the page, and by name — not via a wildcard that
  // would also permit every other Azure web app.
  const csp = index.headers.get('content-security-policy');
  assert.ok(csp.includes('https://eagle-search-api-dev.azurewebsites.net'), 'connect-src must name the search host');
  assert.ok(!csp.includes('*.azurewebsites.net'), 'must not wildcard azurewebsites.net');

  // SPA fallback: a client-side route is not a file and must still return index.html.
  const deep = await fetch(`${base}/projects/abc/documents`);
  assert.strictEqual(deep.status, 200);
  assert.ok((await deep.text()).includes('index'), 'deep links must fall back to index.html');

  // Directory traversal. `new URL()` normalises a raw `../`, but percent-encoded dots survive
  // parsing and only become `../` at decodeURIComponent — after normalisation. That is the vector
  // the guard exists for.
  const encoded = await fetch(`${base}/%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd`);
  assert.strictEqual(encoded.status, 403, 'encoded traversal must be refused');
  assert.ok(!(await encoded.text()).includes('root:'), 'must not leak /etc/passwd');

  // Hashed assets cache hard; runtime config never does.
  assert.match((await fetch(`${base}/main.css`)).headers.get('cache-control'), /immutable/);
  assert.match((await fetch(`${base}/`)).headers.get('cache-control'), /no-store/);

  console.log('azure preview server selftest OK');
  cleanup();
})().catch((e) => {
  console.error('FAILED:', e.message);
  cleanup();
  process.exit(1);
});
