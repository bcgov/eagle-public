/**
 * The reference check `playwright.parity.config.ts` runs as `globalSetup`. Plain Node: each test
 * writes a folder of PNG headers and a manifest, and reads back what the check says about them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { VIEWPORT } from './capture';
import {
  gate,
  MANIFEST_NAME,
  pngSize,
  recordReference,
  referenceProblems,
  sha256,
} from './reference-check';

/** Signature plus IHDR: all the size check reads. */
function pngHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

const FULL = '01-documents-grid-924.png';
const VIEWPORT_ONLY = '06-multiselect-picker-924.png';
const EXPECTED = new Map([[FULL, { width: 924, fullPage: true }]]);

/** A fresh folder under this test's output directory. */
function folder(): string {
  const dir = test.info().outputPath('reference');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Writes `png` as `name` and records it as captured at `pageHeight`. */
function captured(dir: string, name: string, png: Buffer, pageHeight: number, fullPage = true) {
  writeFileSync(join(dir, name), png);
  recordReference(dir, name, { pageHeight, fullPage, sha256: sha256(png) });
}

test('a 900px reference of a 2,400px page is refused, naming both sizes', () => {
  const dir = folder();
  captured(dir, FULL, pngHeader(924, 900), 2400);
  expect(referenceProblems(dir, EXPECTED)).toEqual([
    `${FULL}: is 924x900, expected 924x2400 (full page)`,
  ]);
});

test('a reference narrower than its width is refused', () => {
  const dir = folder();
  captured(dir, FULL, pngHeader(900, 2400), 2400);
  expect(referenceProblems(dir, EXPECTED)).toEqual([
    `${FULL}: is 900x2400, expected 924x2400 (full page)`,
  ]);
});

test('a viewport-only reference is held to the viewport height', () => {
  const dir = folder();
  captured(dir, VIEWPORT_ONLY, pngHeader(924, 2400), 2400, false);
  const expected = new Map([[VIEWPORT_ONLY, { width: 924, fullPage: false }]]);
  expect(referenceProblems(dir, expected)).toEqual([
    `${VIEWPORT_ONLY}: is 924x2400, expected 924x${VIEWPORT.height} (viewport)`,
  ]);
});

test('a reference captured full page for a viewport-only state is refused', () => {
  const dir = folder();
  captured(dir, VIEWPORT_ONLY, pngHeader(924, VIEWPORT.height), VIEWPORT.height, true);
  const expected = new Map([[VIEWPORT_ONLY, { width: 924, fullPage: false }]]);
  expect(referenceProblems(dir, expected)).toEqual([
    `${VIEWPORT_ONLY}: captured as full page, states.ts wants viewport`,
  ]);
});

test('an image swapped for another of the same size is refused', () => {
  const dir = folder();
  captured(dir, FULL, pngHeader(924, 2400), 2400);
  const swapped = Buffer.concat([pngHeader(924, 2400), Buffer.from('other pixels')]);
  writeFileSync(join(dir, FULL), swapped);
  expect(referenceProblems(dir, EXPECTED)).toEqual([
    `${FULL}: SHA-256 differs from ${MANIFEST_NAME}; the image changed after capture`,
  ]);
});

test('a reference with no manifest entry is refused', () => {
  const dir = folder();
  writeFileSync(join(dir, FULL), pngHeader(924, 2400));
  expect(referenceProblems(dir, EXPECTED)).toEqual([
    `${FULL}: is 924x2400, but ${MANIFEST_NAME} has no entry for it; ` +
      'recapture with yarn parity:reference',
  ]);
});

test('an image no state captures is refused', () => {
  const dir = folder();
  captured(dir, FULL, pngHeader(924, 2400), 2400);
  captured(dir, 'stray-924.png', pngHeader(924, 2400), 2400);
  expect(referenceProblems(dir, EXPECTED)).toEqual([
    'stray-924.png: no state in states.ts captures this file',
  ]);
});

test('a reference a state needs but the folder lacks is refused', () => {
  expect(referenceProblems(folder(), EXPECTED)).toEqual([`${FULL}: missing, expected 924px wide`]);
});

test('a manifest entry whose image is gone is refused', () => {
  const dir = folder();
  captured(dir, FULL, pngHeader(924, 2400), 2400);
  recordReference(dir, 'gone-924.png', { pageHeight: 1, fullPage: true, sha256: '0' });
  expect(referenceProblems(dir, EXPECTED)).toEqual([
    `${MANIFEST_NAME}: entry gone-924.png has no image`,
  ]);
});

test('a file named .png that is not a PNG is refused', () => {
  const dir = folder();
  writeFileSync(join(dir, FULL), 'not a png, not even close');
  expect(referenceProblems(dir, EXPECTED)).toEqual([`${FULL}: not a PNG`]);
});

test('a manifest that is not JSON is one named problem', () => {
  const dir = folder();
  writeFileSync(join(dir, MANIFEST_NAME), '{ not json');
  expect(referenceProblems(dir, EXPECTED)).toEqual([
    expect.stringMatching(new RegExp(`^${MANIFEST_NAME}: not valid JSON`)),
  ]);
});

test('a missing reference folder is one named problem', () => {
  const dir = test.info().outputPath('never-created');
  expect(referenceProblems(dir, EXPECTED)).toEqual([`${dir}: reference folder is missing`]);
});

test('a whole-page reference at its width passes', () => {
  const dir = folder();
  captured(dir, FULL, pngHeader(924, 2400), 2400);
  expect(referenceProblems(dir, EXPECTED)).toEqual([]);
});

test('pngSize reads the width and height out of the IHDR', () => {
  expect(pngSize(pngHeader(400, 4820))).toEqual({ width: 400, height: 4820 });
});

test('the gate stops the run when pixels are compared', () => {
  expect(() => gate(['x.png: not a PNG'], false)).toThrow(/x\.png: not a PNG/);
});

test('the gate only warns while pixel comparison is parked', () => {
  expect(gate(['x.png: not a PNG'], true)).toMatch(/x\.png: not a PNG[\s\S]*parked/);
});

test('the gate is silent when every reference is whole', () => {
  expect(gate([], false)).toBeNull();
});
