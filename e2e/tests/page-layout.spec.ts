import { test, expect } from '../support/fixtures';
import { ready, firstProjects, projectByKeyword } from '../support/helpers';

/**
 * One content width and one side gutter for the whole site (src/assets/styles/base/layout.css).
 * The page's first content block and the footer have to start and end on the same x offsets at
 * every width, and no content block may run wider than the cap. The header bar runs full width.
 */

const MAX_WIDTH = 1440;
/** 860 is the width the band's own floor starts at, so it is measured as well as the three sizes. */
const WIDTHS = [390, 860, 1024, 1600];

/** Left and right edge of an element's content box, so padding counts as gutter, not as content. */
async function contentEdges(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 60_000 });
  const edges = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      left: rect.left + parseFloat(style.paddingLeft),
      right: rect.right - parseFloat(style.paddingRight),
    };
  }, selector);
  expect(edges, `${selector} not on the page`).not.toBeNull();
  return edges!;
}

const ROUTES: [string, string][] = [
  ['home', '/'],
  ['search', '/search'],
  ['a static page', '/legislation'],
];

const WIDE_WIDTH = 1600;

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const [name, route] of ROUTES) {
      test(`${name} lines its content and footer up under a full-width header`, async ({
        page,
      }) => {
        await page.goto(route);
        await ready(page, 500);
        await expectAligned(page);
      });
    }

    test('a project page lines its content and footer up under a full-width header', async ({
      page,
      request,
    }) => {
      const project = await projectByKeyword(request, 'Site C');
      await page.goto(`/p/${project._id}/overview`);
      await ready(page);
      await expectAligned(page);
    });

    test('the opening band looks the same on every page that has one', async ({
      page,
      request,
    }) => {
      const project = await projectByKeyword(request, 'Site C');
      const bands: Band[] = [];

      for (const route of ['/', '/search', `/p/${project._id}/overview`]) {
        await page.goto(route);
        await ready(page, 500);
        const band = await bandOf(page);
        // The trail starts on the page's own left edge, not inset from it.
        if (band.crumbLeft !== null) {
          expect(band.crumbLeft, `breadcrumb left edge on ${route}`).toBeCloseTo(
            band.contentLeft,
            1,
          );
        }
        bands.push(band);
      }

      expect(new Set(bands.map((band) => band.background)).size, 'one band background').toBe(1);
      expect(new Set(bands.map((band) => band.paddingTop)).size, 'one band top padding').toBe(1);
      // The trail row is held open on a page with no trail, so every title starts level: the top
      // padding, the trail's own line box and the gap under it, on every page and every width.
      expect(
        bands.map((band) => band.titleTop),
        'title top inside the band',
      ).toEqual([TITLE_TOP, TITLE_TOP, TITLE_TOP]);
      expect(bands.filter((band) => band.crumbLeft !== null)).toHaveLength(2);

      if (width >= EQUAL_HEIGHT_FROM) {
        expect(
          bands.map((band) => band.height),
          'every band stands on the floor page-masthead.css sets',
        ).toEqual([BAND_HEIGHT, BAND_HEIGHT, BAND_HEIGHT]);
      }
    });

    test('the project band puts its actions under the description, not out to the right', async ({
      page,
      request,
    }) => {
      const project = await projectByKeyword(request, 'Site C');
      await page.goto(`/p/${project._id}/overview`);
      await ready(page);

      const box = await page.locator('.page-masthead').evaluate((el) => {
        const edge = (sel: string) => {
          const rect = (el.querySelector(sel) as HTMLElement).getBoundingClientRect();
          return { left: rect.left, top: rect.top, bottom: rect.bottom };
        };
        const firstAction = el.querySelector('.page-masthead__actions button') as HTMLElement;
        return {
          title: edge('h1'),
          meta: edge('.page-masthead__meta'),
          actions: edge('.page-masthead__actions'),
          firstActionLeft: firstAction.getBoundingClientRect().left,
          innerRight: (
            el.querySelector('.page-masthead__inner') as HTMLElement
          ).getBoundingClientRect().right,
        };
      });

      expect(box.actions.left, 'the action row starts on the title edge').toBeCloseTo(
        box.title.left,
        1,
      );
      expect(box.firstActionLeft, 'the first button starts there too').toBeCloseTo(
        box.title.left,
        1,
      );
      expect(box.actions.top, 'the actions sit under the description').toBeGreaterThanOrEqual(
        box.meta.bottom,
      );
      // Right-aligned actions would put the first button against the far edge instead.
      expect(box.firstActionLeft).toBeLessThan(box.innerRight / 2);
    });

    test('the project trail stays on one line, with the project name elided', async ({
      page,
      request,
    }) => {
      const project = await longestNamedProject(request);
      await page.goto(`/p/${project._id}/overview`);
      await ready(page);

      const trail = await page.locator('.breadcrumbs__list').evaluate((list) => {
        const items = [...list.querySelectorAll('.breadcrumbs__item')] as HTMLElement[];
        const current = items[items.length - 1];
        const style = getComputedStyle(current);
        return {
          tops: items.map((item) => Math.round(item.getBoundingClientRect().top)),
          listHeight: Math.round(list.getBoundingClientRect().height),
          itemHeight: Math.round(current.getBoundingClientRect().height),
          whiteSpace: style.whiteSpace,
          textOverflow: style.textOverflow,
          overflow: style.overflow,
          listRight: Math.round(list.getBoundingClientRect().right),
          currentRight: Math.round(current.getBoundingClientRect().right),
        };
      });

      expect(new Set(trail.tops).size, 'every crumb on the same line').toBe(1);
      expect(trail.listHeight, 'the trail is one line box tall').toBe(trail.itemHeight);
      expect(trail.whiteSpace).toBe('nowrap');
      expect(trail.textOverflow).toBe('ellipsis');
      expect(trail.overflow).toBe('hidden');
      // Cut to fit rather than pushed past the content edge.
      expect(trail.currentRight).toBeLessThanOrEqual(trail.listRight);
    });

    if (width === WIDE_WIDTH) {
      test('home browse list is centred in the viewport', async ({ page }) => {
        await page.goto('/');
        await ready(page, 500);
        const list = page.locator('.home-browse__list');
        await list.waitFor({ state: 'visible', timeout: 60_000 });
        await expectCentred(list, '.home-browse__list');
      });

      for (const [name, route] of ROUTES) {
        test(`${name} page-container elements are centred in the viewport`, async ({ page }) => {
          await page.goto(route);
          await ready(page, 500);
          await expectAllContainersCentred(page, name);
        });
      }
    }
  });
}

/** Below this the bands are sized by their content: see the note in page-masthead.css. */
const EQUAL_HEIGHT_FROM = 860;
/** The floor `.page-masthead` sets from that width up: `min-height: 14rem`. */
const BAND_HEIGHT = 224;
/** Top padding + the trail's own line box + the gap under it, the same on every page. */
const TITLE_TOP = 53;

/** The project with the longest name this environment holds, so the trail has to elide it. */
async function longestNamedProject(request: import('@playwright/test').APIRequestContext) {
  const projects = await firstProjects(request, 200);
  const longest = projects.reduce((a, b) => (b.name.length > a.name.length ? b : a));
  expect(longest.name.length, 'no project name long enough to elide').toBeGreaterThan(30);
  return longest;
}

interface Band {
  background: string;
  paddingTop: string;
  contentLeft: number;
  height: number;
  /** Top of the h1, measured from the top of the band. */
  titleTop: number;
  /** null on a page with no trail. */
  crumbLeft: number | null;
}

/** The shared opening band, as a reader sees it: its colour, its top padding and its two edges. */
async function bandOf(page: import('@playwright/test').Page): Promise<Band> {
  const band = page.locator('.page-masthead');
  await band.waitFor({ state: 'visible', timeout: 60_000 });
  return band.evaluate((el) => {
    const inner = el.querySelector('.page-masthead__inner') as HTMLElement;
    const style = getComputedStyle(inner);
    const crumbs = el.querySelector('.breadcrumbs__list');
    const box = el.getBoundingClientRect();
    const title = el.querySelector('h1') as HTMLElement;
    return {
      background: getComputedStyle(el).backgroundColor,
      paddingTop: style.paddingTop,
      contentLeft: inner.getBoundingClientRect().left + parseFloat(style.paddingLeft),
      height: Math.round(box.height),
      titleTop: Math.round(title.getBoundingClientRect().top - box.top),
      crumbLeft: crumbs ? crumbs.getBoundingClientRect().left : null,
    };
  });
}

/** Left and right gap between an element's border box and the viewport edges. */
async function centerGaps(locator: import('@playwright/test').Locator) {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, right: window.innerWidth - rect.right };
  });
}

/** Asserts an element sits in the horizontal middle of the viewport, gaps equal within 2px. */
async function expectCentred(locator: import('@playwright/test').Locator, label: string) {
  const gaps = await centerGaps(locator);
  expect(
    Math.abs(gaps.left - gaps.right),
    `${label} should be centred within 2px`,
  ).toBeLessThanOrEqual(2);
}

/** Every visible `.page-container` on the page should be centred the same way. */
async function expectAllContainersCentred(
  page: import('@playwright/test').Page,
  routeName: string,
) {
  const containers = page.locator('.page-container');
  const count = await containers.count();
  for (let i = 0; i < count; i++) {
    const el = containers.nth(i);
    if (!(await el.isVisible())) continue;
    await expectCentred(el, `.page-container #${i} on ${routeName}`);
  }
}

async function expectAligned(page: import('@playwright/test').Page) {
  // The first block the route renders, whichever container class its markup uses.
  const content = await contentEdges(page, 'main .page-container, main .container');
  const footer = await contentEdges(page, 'footer .page-container');

  expect(footer.left, 'footer starts where the content starts').toBeCloseTo(content.left, 1);
  expect(footer.right, 'footer ends where the content ends').toBeCloseTo(content.right, 1);
  expect(content.right - content.left).toBeLessThanOrEqual(MAX_WIDTH);

  // The header bar is not held to the content width: its row runs the full window.
  const viewport = page.viewportSize()!.width;
  const headerRow = await page.locator('header .eao-header__row').boundingBox();
  expect(headerRow?.x, 'header row starts at the window edge').toBe(0);
  expect(headerRow?.width, 'header row spans the window').toBeCloseTo(viewport, 0);
}
