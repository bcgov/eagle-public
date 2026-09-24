/**
 * Checks the reference images before any parity spec runs.
 *
 * A reference that is narrower than its width, or that stops at the first 900px of a taller page,
 * compares nothing below the fold and passes anyway. Each image is held to what
 * `capture-reference.ts` recorded in `manifest.json` when it wrote the image: the page height,
 * whether the shot was full page, and the image's SHA-256.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PIXEL_COMPARISON_PARKED, VIEWPORT } from './capture';
import { REFERENCE_DIR } from './paths';
import { STATES, widthsFor } from './states';

export const MANIFEST_NAME = 'manifest.json';

/** What the capture measured on the page it photographed. */
export interface ReferenceEntry {
  /** The document's full scroll height, or the viewport height for a viewport-only state. */
  pageHeight: number;
  fullPage: boolean;
  sha256: string;
}

export type Manifest = Record<string, ReferenceEntry>;

type Expected = Map<string, { width: number; fullPage: boolean }>;

/** Every reference the states call for, keyed by file name. */
export function expectedReferences(): Expected {
  const expected: Expected = new Map();
  for (const state of STATES) {
    for (const width of widthsFor(state)) {
      expected.set(`${state.id}-${width}.png`, { width, fullPage: !state.viewportOnly });
    }
  }
  return expected;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height out of the PNG's IHDR chunk, which always comes first. */
export function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Throws on a manifest that is not JSON; a missing one reads as empty. */
export function readManifest(dir: string): Manifest {
  const file = join(dir, MANIFEST_NAME);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Manifest) : {};
}

/** Records one capture. Read, change, write: the capture runs one worker, so nothing races. */
export function recordReference(dir: string, file: string, entry: ReferenceEntry): void {
  const manifest = readManifest(dir);
  manifest[file] = entry;
  // Code-unit order, so the file sorts the same whatever the machine's locale.
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  writeFileSync(join(dir, MANIFEST_NAME), JSON.stringify(sorted, null, 2) + '\n');
}

/** One line per reference that cannot be trusted; empty when every image is whole. */
export function referenceProblems(dir: string, expected: Expected): string[] {
  if (!existsSync(dir)) return [`${dir}: reference folder is missing`];

  let manifest: Manifest;
  try {
    manifest = readManifest(dir);
  } catch (error) {
    return [`${MANIFEST_NAME}: not valid JSON (${(error as Error).message})`];
  }

  const problems: string[] = [];
  const present = new Set(readdirSync(dir).filter((name) => name.endsWith('.png')));

  for (const name of present) {
    if (!expected.has(name)) problems.push(`${name}: no state in states.ts captures this file`);
  }
  for (const name of Object.keys(manifest)) {
    if (!present.has(name)) problems.push(`${MANIFEST_NAME}: entry ${name} has no image`);
  }

  for (const [name, want] of expected) {
    if (!present.has(name)) {
      problems.push(`${name}: missing, expected ${want.width}px wide`);
      continue;
    }
    const bytes = readFileSync(join(dir, name));
    const size = pngSize(bytes);
    if (!size) {
      problems.push(`${name}: not a PNG`);
      continue;
    }
    const entry = manifest[name];
    if (!entry) {
      problems.push(
        `${name}: is ${size.width}x${size.height}, but ${MANIFEST_NAME} has no entry for it; ` +
          'recapture with yarn parity:reference',
      );
      continue;
    }
    const scope = (fullPage: boolean) => (fullPage ? 'full page' : 'viewport');
    if (entry.fullPage !== want.fullPage) {
      problems.push(
        `${name}: captured as ${scope(entry.fullPage)}, states.ts wants ${scope(want.fullPage)}`,
      );
      continue;
    }
    const height = want.fullPage ? entry.pageHeight : VIEWPORT.height;
    if (size.width !== want.width || size.height !== height) {
      problems.push(
        `${name}: is ${size.width}x${size.height}, ` +
          `expected ${want.width}x${height} (${scope(want.fullPage)})`,
      );
      continue;
    }
    if (sha256(bytes) !== entry.sha256) {
      problems.push(
        `${name}: SHA-256 differs from ${MANIFEST_NAME}; the image changed after capture`,
      );
    }
  }
  return problems;
}

/**
 * Throws when pixels are compared, so no spec runs against a bad reference; while the comparison
 * is parked, returns the warning instead, since no spec reads the images.
 */
export function gate(problems: string[], parked: boolean): string | null {
  if (problems.length === 0) return null;
  const message = `Parity references refused (${REFERENCE_DIR}):\n  ${problems.join('\n  ')}`;
  if (!parked) throw new Error(message);
  return `${message}\nPixel comparison is parked, so the run continues.`;
}

/** Playwright `globalSetup`. */
export default function checkReferences(): void {
  const warning = gate(
    referenceProblems(REFERENCE_DIR, expectedReferences()),
    PIXEL_COMPARISON_PARKED,
  );
  if (warning) console.warn(warning);
}
