/**
 * A read-only static server over the design handoff folder.
 *
 * The prototype cannot be opened with `file://`: `support.js` resolves `<dc-import name="Display
 * Grid - Rebuild">` with `fetch`, which a file URL answers with an opaque origin error. Serving the
 * folder over loopback is the smallest thing that makes the import work, and it keeps the capture
 * to one process with no package to install.
 */
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// `__dirname`, not `import.meta.url`: Playwright transpiles these files to CommonJS.
export const PROTOTYPE_DIR = resolve(__dirname, '..', '..', 'design', 'handoffs', 'unified-search');

export const PROTOTYPE_PAGE = 'Search - Unified.dc.html';

export interface PrototypeServer {
  origin: string;
  url: string;
  close: () => Promise<void>;
}

export async function startPrototypeServer(root = PROTOTYPE_DIR): Promise<PrototypeServer> {
  const server: Server = createServer((request, response) => {
    const requested = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
    const file = join(root, normalize(requested));
    // Normalising first then re-checking the prefix keeps `../` out of the served tree.
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end('outside the handoff folder');
      return;
    }
    readFile(file).then(
      (body) => {
        response.writeHead(200, {
          'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        });
        response.end(body);
      },
      () => response.writeHead(404).end(`not in the handoff folder: ${requested}`),
    );
  });

  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('prototype server has no port');
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    url: `${origin}/${encodeURIComponent(PROTOTYPE_PAGE)}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
