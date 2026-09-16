/**
 * Captures the reference screenshots from the design prototype.
 *
 * These PNGs are the parity gate's expected values: they come out of the designed artefact, not
 * out of the code under test, which is the whole point. Recapture only when the handoff changes.
 *
 *   yarn parity:reference
 *
 * Each state is its own test so a state that cannot be reached fails on its own and the rest
 * still capture.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import {
  checkMeasurements,
  freezeClock,
  hidesScopeSegment,
  runSteps,
  SCOPE_SEGMENT_CSS,
  settle,
  STILL_CSS,
} from './drive';
import { startPrototypeServer, type PrototypeServer } from './prototype-server';
import { selectorFor } from './selectors';
import { REFERENCE_DIR } from './paths';
import { measurementsFor, STATES, WIDE, widthsFor } from './states';

/**
 * `support.js` sizes the artboard to the window (`html,body{height:100%}`,
 * `#dc-root,#dc-root>.sc-host{height:100%}`), which makes the body its own scroll container and
 * leaves `fullPage` photographing one fold of design over blank canvas. Only these four boxes are
 * released: scroll regions the design asks for, such as the table's `max-height: 560px`, are part
 * of what the app has to reproduce.
 */
const EXPAND_PAGE_CSS = `
  html, body, #dc-root, #dc-root > .sc-host {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
`;

/** Matches the viewport the parity spec compares against. */
const VIEWPORT_HEIGHT = 900;

/**
 * Accepted deviation, 2026-09-12: the prototype's `epic/styles.css` still `@import`s the
 * pre-redesign `app/footer.css` over the `site-footer.css` both sides share, which pads the
 * footer by 18px the app never draws. Blocked, not overridden, so the box is the app's own.
 */
async function blockLegacyFooterStyles(page: Page): Promise<void> {
  await page.route('**/epic/app/footer.css', (route) => route.abort());
}

/**
 * Adds the fourth record pill, Project notifications, which the design was drawn without.
 * Accepted deviation, 2026-09-12; the app's matching count badge is hidden (`drive.ts`).
 *
 * Run after the steps: every click re-renders the prototype's tab list from its own data.
 */
async function addNotificationsPill(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('[data-tour="types"] button'));
    if (pills.length !== 3) throw new Error(`prototype drew ${pills.length} record pills, not 3`);
    const clone = pills[2]!.cloneNode(true) as HTMLElement;
    // Styling is inline and per-pill, so an unpressed sibling is the only source of the off state.
    const off = pills.find((pill) => pill.getAttribute('aria-pressed') !== 'true') ?? pills[2]!;
    clone.setAttribute('aria-pressed', 'false');
    clone.setAttribute('style', off.getAttribute('style') ?? '');
    // The prototype draws a pill as label span then count span; the count goes, the label is set.
    const [label, count] = Array.from(clone.querySelectorAll('span'));
    if (!label) throw new Error('record pill has no label');
    label.textContent = 'Project notifications';
    count?.remove();
    pills[2]!.after(clone);
  });
}

/**
 * Accepted deviation, 2026-09-14: the design's project card prints a Legislation pair the app has
 * no value for. Projects reach the page through the by-decision index, which carries no
 * legislation field, so the app would have to invent one. Hidden on the design side, at the one
 * width and state where a project card is drawn.
 *
 * The prototype builds a card's pairs in a fixed order (see `fields` in the handoff): the
 * non-link, non-date columns first — Proponent, Type, Region, Phase — then the advanced filters
 * that are a select or a toggle, of which Legislation is the first. That makes it the fifth pair,
 * and `assertLegislationHidden` checks that before the shot is taken.
 */
const PROJECT_LEGISLATION_CSS = `
  .grid-root ol dl > div:nth-child(5) { display: none !important; }
`;

/** The state whose narrow layout draws project cards. */
const PROJECTS_CARD_STATE = '02-projects-grid';

/**
 * Accepted deviation, 2026-09-14: the design lists up to four attachments per activity and prints
 * a "PDF · 4.2 MB" span beside each name. A `RecentActivity` carries one `documentUrl` and neither
 * a file type nor a size, so the app can draw one name and nothing else. Trimmed on the design
 * side, at both widths of the one state that lists activities.
 *
 * The count line above the list is rewritten with the attachments, or the design would keep
 * announcing files it no longer shows.
 */
const ACTIVITIES_LIST_STATE = '03-activities-list';

/** The count line the prototype prints above an activity's attachments, and what one file reads. */
const DOCS_LABEL = /^\d+ documents?$/;
const ONE_DOCUMENT = '1 document';

/**
 * Drops every attachment but the first, and the type/size span beside the one that is left.
 *
 * An attachment block is a `ul` whose preceding line is the file count, which is what separates it
 * from the content-hit snippets the prototype draws with the same markup. The finder is written
 * out again in `assertOneAttachment`: page-context code cannot call a helper from this file.
 */
async function trimActivityAttachments(page: Page): Promise<void> {
  await page.evaluate(
    ([pattern, one]) => {
      const label = new RegExp(pattern!);
      for (const list of document.querySelectorAll('.grid-root ol ul')) {
        const line = list.previousElementSibling;
        if (!line || !label.test((line.textContent ?? '').trim())) continue;
        const items = Array.from(list.children);
        for (const extra of items.slice(1)) extra.remove();
        // The file name is an <a> of its own; the row's only direct span is "PDF · 4.2 MB".
        items[0]?.querySelector(':scope > span')?.remove();
        line.textContent = one!;
      }
    },
    [DOCS_LABEL.source, ONE_DOCUMENT] as const,
  );
}

/** A trim that matched nothing, or left a second file behind, would quietly change the reference. */
async function assertOneAttachment(page: Page): Promise<void> {
  const rows = await page.evaluate((pattern) => {
    const label = new RegExp(pattern);
    const found: { files: number; metas: number; line: string }[] = [];
    for (const list of document.querySelectorAll('.grid-root ol ul')) {
      const line = list.previousElementSibling;
      const text = (line?.textContent ?? '').trim();
      if (!line || !label.test(text)) continue;
      found.push({
        files: list.children.length,
        metas: list.querySelectorAll('li > span').length,
        line: text,
      });
    }
    return found;
  }, DOCS_LABEL.source);
  expect(rows.length, 'no activity drew an attachment block').toBeGreaterThan(0);
  expect(
    rows.filter((row) => row.files !== 1),
    'an activity kept more than one attachment',
  ).toEqual([]);
  expect(
    rows.filter((row) => row.metas !== 0),
    'an attachment kept its type and size',
  ).toEqual([]);
  expect(
    rows.filter((row) => row.line !== ONE_DOCUMENT),
    'a count line still names the files the design dropped',
  ).toEqual([]);
}

/** An nth-child rule that has drifted onto another pair would quietly change the reference. */
async function assertLegislationHidden(page: Page): Promise<void> {
  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.grid-root ol dl > div')).map((pair) => ({
      label: pair.querySelector('dt')?.textContent?.trim() ?? '',
      hidden: getComputedStyle(pair).display === 'none',
    })),
  );
  expect(labels.length, 'project cards drew no field pairs').toBeGreaterThan(0);
  const hidden = labels.filter((pair) => pair.hidden).map((pair) => pair.label);
  expect(new Set(hidden), 'hid a pair that is not Legislation').toEqual(new Set(['Legislation']));
  expect(
    labels.filter((pair) => pair.label === 'Legislation' && !pair.hidden),
    'a Legislation pair survived the rule',
  ).toEqual([]);
}

let server: PrototypeServer;

test.beforeAll(async () => {
  server = await startPrototypeServer();
  mkdirSync(REFERENCE_DIR, { recursive: true });
});

test.afterAll(async () => {
  await server.close();
});

for (const state of STATES) {
  for (const width of widthsFor(state)) {
    test(`${state.id} @ ${width}`, async ({ page }) => {
      await freezeClock(page);
      await blockLegacyFooterStyles(page);
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto(server.url, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: STILL_CSS });
      if (hidesScopeSegment(state)) await page.addStyleTag({ content: SCOPE_SEGMENT_CSS });

      // The grid arrives through `dc-import`, so the wrapper's load event is not enough.
      await page.locator(selectorFor('root', 'proto')).first().waitFor({ state: 'visible' });
      await settle(page);

      // Released before the steps run, not after, so the layout that is measured at the end of the
      // test is the same layout that was photographed.
      await page.addStyleTag({ content: EXPAND_PAGE_CSS });
      await settle(page);

      await runSteps(page, state.steps, 'proto');
      await addNotificationsPill(page);
      if (state.id === PROJECTS_CARD_STATE && width !== WIDE) {
        await page.addStyleTag({ content: PROJECT_LEGISLATION_CSS });
      }
      if (state.id === ACTIVITIES_LIST_STATE) await trimActivityAttachments(page);
      await settle(page);

      if (state.id === PROJECTS_CARD_STATE && width !== WIDE) await assertLegislationHidden(page);
      if (state.id === ACTIVITIES_LIST_STATE) await assertOneAttachment(page);

      const fullPage = !state.viewportOnly;
      const png = await page.screenshot({ fullPage, scale: 'css' });

      // A clipped document writes a reference that cannot fail, so prove the release took before
      // anything reaches disk. Size out of the PNG's IHDR: width at byte 16, height at 20.
      if (fullPage) {
        const box = await page.evaluate(() => ({
          documentHeight: document.documentElement.scrollHeight,
          bodyHeight: document.body.scrollHeight,
        }));
        expect(box.documentHeight, 'document is clipped above the body').toBe(box.bodyHeight);
        expect(png.readUInt32BE(20), 'captured height').toBe(box.documentHeight);
      } else {
        expect(png.readUInt32BE(20), 'captured height').toBe(VIEWPORT_HEIGHT);
      }
      expect(png.readUInt32BE(16), 'captured width').toBe(width);

      writeFileSync(join(REFERENCE_DIR, `${state.id}-${width}.png`), png);

      // Measuring here too means a reference that no longer meets the design spec fails at
      // capture time, rather than silently becoming the thing the app is held to.
      await checkMeasurements(page, measurementsFor(state, width), 'proto');
    });
  }
}
