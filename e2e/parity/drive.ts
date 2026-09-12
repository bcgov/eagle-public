/**
 * Shared driving code: replaying a step list, freezing everything that moves, and reading the
 * measurements back. Both the reference capture and the app-side spec go through here, so a
 * screenshot taken on one side and a screenshot taken on the other differ only in what rendered.
 */
import { expect, type Page } from '@playwright/test';

import { selectorFor, type Side } from './selectors';
import { FIXED_NOW, type Measurement, type Step } from './states';

/**
 * No transitions, no caret blink, no smooth scrolling. Left on, each of these turns a pixel
 * comparison into a coin toss.
 */
export const STILL_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    scroll-behavior: auto !important;
  }
  * { caret-color: transparent !important; }
  input, textarea { caret-color: transparent !important; }
`;

/** Pins the clock before any page script runs, so "today" is the same on every capture. */
export async function freezeClock(page: Page): Promise<void> {
  await page.addInitScript((now) => {
    const RealDate = Date;
    const fixed = new RealDate(now);
    class FrozenDate extends RealDate {
      constructor(...args: unknown[]) {
        // `new Date()` is the only form that has to lie; every explicit argument passes through.
        if (args.length === 0) super(now);
        else super(...(args as []));
      }
      static override now() {
        return now;
      }
    }
    Object.defineProperty(FrozenDate, 'name', { value: 'Date' });
    globalThis.Date = FrozenDate as unknown as DateConstructor;
    void fixed;
  }, FIXED_NOW);
}

export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  // Two frames: one for the state change to paint, one for anything it triggered.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

export async function runSteps(page: Page, steps: readonly Step[], side: Side): Promise<void> {
  for (const step of steps) {
    const target = page.locator(selectorFor(step.control, side)).first();
    if (step.do === 'click') {
      await target.click();
    } else if (step.do === 'fill') {
      await target.fill(step.value);
    } else {
      await target.waitFor({ state: 'visible' });
    }
    await settle(page);
  }
}

/** Resolves a CSS custom property to the value the browser computed for it, in page context. */
async function resolveVar(page: Page, selector: string, variable: string): Promise<string> {
  return page.evaluate(
    ([sel, name]) => {
      const element = document.querySelector(sel as string);
      if (!element) throw new Error(`no element for ${sel}`);
      const probe = document.createElement('span');
      probe.style.color = `var(${name})`;
      element.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    },
    [selector, variable] as const,
  );
}

export async function checkMeasurements(
  page: Page,
  measurements: readonly Measurement[],
  side: Side,
): Promise<void> {
  for (const measurement of measurements) {
    const selector = selectorFor(measurement.control, side);
    const locator = page.locator(selector).first();

    if (measurement.kind === 'boxHeight') {
      const box = await locator.boundingBox();
      expect(box, `${measurement.control} is not laid out`).not.toBeNull();
      expect(Math.round(box!.height), `${measurement.control} height`).toBe(measurement.px);
      continue;
    }
    if (measurement.kind === 'boxMinWidth') {
      const box = await locator.boundingBox();
      expect(box, `${measurement.control} is not laid out`).not.toBeNull();
      expect(Math.round(box!.width), `${measurement.control} width`).toBeGreaterThanOrEqual(
        measurement.px,
      );
      continue;
    }
    if (measurement.kind === 'minHeight') {
      const box = await locator.boundingBox();
      expect(box, `${measurement.control} is not laid out`).not.toBeNull();
      expect(Math.round(box!.height), `${measurement.control} height`).toBeGreaterThanOrEqual(
        measurement.px,
      );
      continue;
    }
    if (measurement.kind === 'styleContains') {
      const actual = await locator.evaluate(
        (element, property) => getComputedStyle(element).getPropertyValue(property as string),
        measurement.property,
      );
      expect(actual, `${measurement.control} ${measurement.property}`).toContain(
        measurement.contains,
      );
      continue;
    }
    if (measurement.kind === 'styleVar') {
      const actual = await locator.evaluate(
        (element, property) => getComputedStyle(element).getPropertyValue(property as string),
        measurement.property,
      );
      const expected = await resolveVar(page, selectorFor('root', side), measurement.variable);
      // `box-shadow` carries the colour inside a longer value; a background is the value itself.
      if (measurement.property === 'background-color') {
        expect(actual.trim(), `${measurement.control} ${measurement.property}`).toBe(
          expected.trim(),
        );
      } else {
        expect(actual, `${measurement.control} ${measurement.property}`).toContain(expected.trim());
      }
      continue;
    }
    const zIndex = await locator.evaluate((element) => {
      // The stacking value that matters is the nearest positioned ancestor's, which is what the
      // overlay sets; a dialog inside it inherits `auto`.
      let node: HTMLElement | null = element as HTMLElement;
      while (node) {
        const value = getComputedStyle(node).zIndex;
        if (value !== 'auto') return Number(value);
        node = node.parentElement;
      }
      return 0;
    });
    expect(zIndex, `${measurement.control} z-index`).toBeGreaterThan(measurement.floor);
  }
}
