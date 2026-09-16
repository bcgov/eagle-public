/**
 * Pulls the prototype's sample data out of the design handoff and writes it as JSON fixtures.
 *
 * The prototype keeps its data in the `<script type="text/x-dc">` block of
 * `Display Grid - Rebuild.dc.html`, as plain array/object literals followed by a few `forEach`
 * passes that derive `legislation`, `featured`, `iaac`, `decision` and `hasDocuments`. This script
 * slices exactly that region of the script block and evaluates it in a `node:vm` context with no
 * globals beyond `Intl`, so nothing in the file can reach the filesystem or the network. Anything
 * after the region (the component class, the renderer) is never evaluated.
 *
 * Run: node e2e/parity/extract-fixtures.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const PROTOTYPE = join(
  repoRoot,
  'design',
  'handoffs',
  'unified-search',
  'Display Grid - Rebuild.dc.html',
);
const OUT_DIR = join(repoRoot, 'e2e', 'fixtures', 'unified-search');

/** The first and last lines of the data region, matched literally so a rename fails loudly. */
const REGION_START = 'const DOCS = [';
const REGION_END = 'const DATASETS = {';

function sliceDataRegion(html) {
  const start = html.indexOf(REGION_START);
  if (start === -1) throw new Error(`prototype no longer contains "${REGION_START}"`);
  const end = html.indexOf(REGION_END, start);
  if (end === -1) throw new Error(`prototype no longer contains "${REGION_END}"`);
  return html.slice(start, end);
}

function evaluate(source) {
  // No `require`, no `process`, no `fetch`: the only reachable global is `Intl`, which the region
  // does not use anyway. A literal that tried to call out would throw a ReferenceError here.
  const sandbox = createContext({ Intl });
  runInContext(`${source}\nthis.__out = { DOCS, PROJECTS, UPDATES, CONTENTS };`, sandbox, {
    filename: 'Display Grid - Rebuild.dc.html#data',
    timeout: 5000,
  });
  return sandbox.__out;
}

function write(name, value) {
  const path = join(OUT_DIR, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  const count = Array.isArray(value) ? value.length : Object.keys(value).length;
  console.log(`${name}.json  ${count} entries`);
}

const { DOCS, PROJECTS, UPDATES, CONTENTS } = evaluate(sliceDataRegion(readFileSync(PROTOTYPE, 'utf8')));

mkdirSync(OUT_DIR, { recursive: true });
// `contents` is written once, as passages.json; carrying it on the document rows too would let the
// two copies drift.
write(
  'documents',
  DOCS.map(({ contents: _contents, ...rest }) => rest),
);
write('projects', PROJECTS);
write('activities', UPDATES);
write('passages', CONTENTS);
