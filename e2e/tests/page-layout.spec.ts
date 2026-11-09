import { test, expect } from '../support/fixtures';
import { ready, firstProjects, projectByKeyword, showSubscribe } from '../support/helpers';

/* One content width and gutter site-wide (base/layout.css): content and footer share x edges at
   every width, none wider than the cap. The header bar runs full width. */

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
  ['a static page', '/about'],
];

const WIDE_WIDTH = 1600;
/** The widths where the About rail stands beside the column with least room to spare. */
const RAIL_BESIDE_WIDTHS = [860, 1024];

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
      for (const [name, route] of ROUTES) {
        test(`${name} page-container elements are centred in the viewport`, async ({ page }) => {
          await page.goto(route);
          await ready(page, 500);
          await expectAllContainersCentred(page, name);
        });
      }

      test('the About content column is centred in the viewport', async ({ page }) => {
        await page.goto('/about');
        await ready(page, 500);
        await expectCentred(page.locator('.about__content'), '.about__content');
      });
    }

    if (RAIL_BESIDE_WIDTHS.includes(width)) {
      test('the About rail ends before the content column starts', async ({ page }) => {
        await page.goto('/about');
        await ready(page, 500);
        const rail = await page.locator('.about-rail').boundingBox();
        const content = await page.locator('.about__content').boundingBox();
        expect(rail!.x + rail!.width).toBeLessThanOrEqual(content!.x);
      });
    }
  });
}

test.describe('masthead title at 860px', () => {
  test.use({ viewport: { width: 860, height: 900 } });

  for (const route of ['/', '/about']) {
    test(`the title on ${route} is not clipped`, async ({ page }) => {
      await page.goto(route);
      const title = page.getByRole('heading', { level: 1 });
      await ready(page, title);

      const clipped = await title.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(clipped, 'px of the title cut off by its box').toBe(0);
    });
  }
});

test.describe('home body at 390px', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('the home page opens on Map Explorer, stacked over Updates', async ({ page }) => {
    await page.goto('/');
    await ready(page, 500);
    const map = await page.getByRole('region', { name: 'Map Explorer' }).boundingBox();
    const updates = await page.getByRole('region', { name: 'Updates' }).boundingBox();
    expect(map!.x, 'one left edge with Updates').toBeCloseTo(updates!.x, 0);
    expect(map!.y + map!.height).toBeLessThanOrEqual(updates!.y);
  });
});

/** 280px + (content - 480px - 280px - 24px gap) / 2.6; content = min(width, 1440) less both gutters. */
const HOME_RIGHT_COLUMN_WIDTHS: [number, number][] = [
  [768, 261.5],
  [860, 290.8],
  [1024, 353.8],
  [1600, 513.8],
];
/** `.home-body` gap, `--layout-padding-large`. */
const HOME_BODY_GAP = 24;

for (const [width, column] of HOME_RIGHT_COLUMN_WIDTHS) {
  test.describe(`home body at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('Map Explorer tops the right column, level with Updates, over Open for comment', async ({
      page,
    }) => {
      await page.goto('/');
      await ready(page, 500);
      const heading = (name: string) => page.getByRole('heading', { level: 2, name }).boundingBox();
      const region = (name: string) => page.getByRole('region', { name }).boundingBox();
      const mapHeading = await heading('Map Explorer');
      const updatesHeading = await heading('Updates');
      const map = await region('Map Explorer');
      const updates = await region('Updates');
      const periods = await region('Open for comment');

      expect(mapHeading!.y, 'heading level with Updates').toBeCloseTo(updatesHeading!.y, 0);
      expect(map!.x, 'right of the Updates column').toBeGreaterThanOrEqual(
        updates!.x + updates!.width,
      );
      expect(Math.abs(map!.width - column), `right column ${map!.width}px`).toBeLessThanOrEqual(1);
      expect(map!.x, 'one left edge with Open for comment').toBeCloseTo(periods!.x, 0);
      const gap = periods!.y - (map!.y + map!.height);
      expect(
        Math.abs(gap - HOME_BODY_GAP),
        `gap over Open for comment ${gap}px`,
      ).toBeLessThanOrEqual(1);
    });
  });
}

const SITE_NAME = 'EAO Environmental Assessment Office Project Information Centre';
const SITE_TITLE = 'Project Information Centre';
const LOCKUP = 'header .eao-header__lockup';

/** A visually hidden element keeps a 1px box, so it stays in the link's name but paints nothing. */
const painted = async (locator: import('@playwright/test').Locator) =>
  (await locator.boundingBox())!.width > 1;

/** The 2.5rem mark plus the home link's padding: 4px a side below 768px, 8px from there up. */
const HEADER_ROWS: [number, number][] = [
  [320, 48],
  [375, 48],
  [767, 48],
  [768, 56],
  [1200, 56],
];

for (const [width, rowHeight] of HEADER_ROWS) {
  test.describe(`header at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`the header row stands ${rowHeight}px tall`, async ({ page }) => {
      await page.goto('/');
      await ready(page, 500);
      await page.evaluate(() => document.fonts.ready);
      const row = await page.locator('header .eao-header__row').boundingBox();
      expect(Math.round(row!.height)).toBe(rowHeight);
    });

    test('the home link is named for the office and the site', async ({ page }) => {
      await page.goto('/');
      await ready(page, 500);
      const home = page.getByRole('banner').getByRole('link', { name: SITE_NAME, exact: true });
      await expect(home).toHaveAttribute('href', '/');
    });
  });
}

/* Window width, then whether the lockup and the title paint. */
const HEADER_MARKS: [number, boolean, boolean][] = [
  [359, false, false],
  [360, true, false],
  [899, true, false],
  [900, true, true],
];

for (const [width, lockupShown, titleShown] of HEADER_MARKS) {
  test.describe(`header marks at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`lockup painted: ${lockupShown}, title painted: ${titleShown}`, async ({ page }) => {
      await page.goto('/');
      await ready(page, 500);
      await page.evaluate(() => document.fonts.ready);

      expect(await painted(page.locator(LOCKUP)), 'lockup').toBe(lockupShown);
      expect(await painted(page.getByRole('banner').getByText(SITE_TITLE)), 'title').toBe(
        titleShown,
      );
    });
  });
}

for (const width of [768, 1200]) {
  test.describe(`header marks load at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('both marks load and the lockup centres on the B.C. mark', async ({ page }) => {
      await page.goto('/');
      await ready(page, 500);
      await page.evaluate(() => document.fonts.ready);

      const mark = page.locator('header .eao-header__mark');
      const lockup = page.locator(LOCKUP);
      // Each PNG's own width; 0 means the file did not load.
      expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(340);
      expect(await lockup.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(336);
      const logo = (await mark.boundingBox())!;
      const words = (await lockup.boundingBox())!;
      const logoCentre = logo.y + logo.height / 2;
      const wordsCentre = words.y + words.height / 2;
      expect(
        Math.abs(wordsCentre - logoCentre),
        `lockup centre ${wordsCentre}, logo centre ${logoCentre}`,
      ).toBeLessThanOrEqual(1);
    });
  });
}

for (const width of [900, 1200]) {
  test.describe(`header title at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the title centres on the B.C. mark', async ({ page }) => {
      await page.goto('/');
      await ready(page, 500);
      await page.evaluate(() => document.fonts.ready);

      const logo = (await page.locator('header .eao-header__mark').boundingBox())!;
      const title = (await page.getByRole('banner').getByText(SITE_TITLE).boundingBox())!;
      const logoCentre = logo.y + logo.height / 2;
      const titleCentre = title.y + title.height / 2;
      expect(
        Math.abs(titleCentre - logoCentre),
        `title centre ${titleCentre}, logo centre ${logoCentre}`,
      ).toBeLessThanOrEqual(1);
    });
  });
}

/* The last mark painted at each width: the lockup gives way below 360px. */
const LAST_MARKS: [number, string][] = [
  [320, 'header .eao-header__mark'],
  [360, LOCKUP],
  [375, LOCKUP],
];

for (const [width, selector] of LAST_MARKS) {
  test.describe(`header marks at ${width}px beside the menu`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the last mark stays clear of the menu button', async ({ page }) => {
      await page.goto('/');
      await ready(page, 500);
      await page.evaluate(() => document.fonts.ready);

      const mark = (await page.locator(selector).boundingBox())!;
      const toggler = (await page.getByRole('button', { name: 'Menu' }).boundingBox())!;
      expect(mark.x + mark.width).toBeLessThanOrEqual(toggler.x);
    });
  });
}

/* Headless Chromium hides scrollbars, so a 15px html margin narrows the header, not the window.
   Each header width is under one rule's breakpoint while the window is at or over it. */
const SCROLLBAR_CASES: [number, number, string, number][] = [
  [360, 345, LOCKUP, 48],
  [900, 885, 'header .eao-header__title', 56],
];

for (const [width, header, selector, rowHeight] of SCROLLBAR_CASES) {
  test.describe(`header at ${width}px beside a 15px scrollbar`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`${selector} gives way to the header width and the row stays ${rowHeight}px`, async ({
      page,
    }) => {
      await page.goto('/');
      await ready(page, 500);
      await page.addStyleTag({ content: 'html { margin-right: 15px }' });
      await page.evaluate(() => document.fonts.ready);

      const bar = (await page.getByRole('banner').boundingBox())!;
      expect(bar.width, 'header width').toBe(header);
      const row = await page.locator('header .eao-header__row').boundingBox();
      expect(Math.round(row!.height)).toBe(rowHeight);
      expect(await painted(page.locator(selector))).toBe(false);
    });
  });
}

test.describe('header at 768px with 20px root text', () => {
  test.use({ viewport: { width: 768, height: 900 } });

  // 41rem is 820px at this text size, so the lockup gives way rather than run under the nav.
  test('the lockup gives way once the nav shares its row', async ({ page }) => {
    await page.goto('/');
    await ready(page, 500);
    await page.addStyleTag({ content: 'html { font-size: 20px }' });
    await page.evaluate(() => document.fonts.ready);

    expect(await painted(page.locator(LOCKUP))).toBe(false);
  });
});

test.describe('header title at 900px', () => {
  test.use({ viewport: { width: 900, height: 900 } });

  test('the title stays on one line once it shows beside the nav', async ({ page }) => {
    await page.goto('/');
    await ready(page, 500);
    await page.evaluate(() => document.fonts.ready);
    const title = (await page.getByRole('banner').getByText(SITE_TITLE).boundingBox())!;
    expect(title.height).toBe(16);
  });
});

for (const width of [768, 1200]) {
  test.describe(`header current link at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the current link is white and bold, its gold bar on the row bottom', async ({ page }) => {
      await page.goto('/about');
      await ready(page, 500);
      await page.evaluate(() => document.fonts.ready);

      const banner = page.getByRole('banner');
      const link = banner.getByRole('link', { name: 'About' });
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(link).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(link).toHaveCSS('font-weight', '700');
      await expect(link).toHaveCSS('border-bottom-width', '4px');
      await expect(link).toHaveCSS('border-bottom-color', 'rgb(252, 186, 25)');
      const box = (await link.boundingBox())!;
      const row = (await page.locator('header .eao-header__row').boundingBox())!;
      expect(Math.round(box.y + box.height)).toBe(Math.round(row.y + row.height));
    });
  });
}

/** Left edge and text baseline (line box top plus the font's ascent) of the heading and the button. */
async function updatesHeadRow(page: import('@playwright/test').Page) {
  const updates = page.getByRole('region', { name: 'Updates' });
  await updates.getByRole('button', { name: 'Subscribe to updates' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return updates.evaluate((section) => {
    const measure = (el: Element) => {
      const label = [...el.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim(),
      )!;
      const range = document.createRange();
      range.selectNodeContents(label);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = getComputedStyle(el).font;
      const ascent = ctx.measureText(label.textContent!.trim()).fontBoundingBoxAscent;
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        bottom: box.bottom,
        baseline: range.getBoundingClientRect().top + ascent,
      };
    };
    return {
      heading: measure(section.querySelector('h2')!),
      button: measure(section.querySelector('.subscribe-dialog__trigger')!),
    };
  });
}

test.describe('home Updates heading row at 1440px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the subscribe button sits on the heading’s baseline', async ({ page }) => {
    await showSubscribe(page);
    await page.goto('/');
    await ready(page, 500);
    const row = await updatesHeadRow(page);
    expect(row.button.top, 'beside the heading, not under it').toBeLessThan(row.heading.bottom);
    // A flex button's baseline is its icon's, which puts the label 1px off the heading's.
    expect(row.button.baseline, 'button label baseline').toBeCloseTo(row.heading.baseline, 0);
  });
});

test.describe('home Updates heading row when it wraps', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  // No real width wraps "Updates" and the button, so the row is held to 240px.
  test('the subscribe button drops under the heading on its left edge', async ({ page }) => {
    await showSubscribe(page);
    await page.goto('/');
    await ready(page, 500);
    await page.addStyleTag({ content: '.home-updates__head { max-width: 240px }' });
    const row = await updatesHeadRow(page);
    expect(row.button.top, 'under the heading').toBeGreaterThanOrEqual(row.heading.bottom);
    expect(row.button.left).toBeCloseTo(row.heading.left, 0);
  });
});

// Under 768px the link has room to stretch past its marks.
test.describe('header home link at 600px', () => {
  test.use({ viewport: { width: 600, height: 900 } });

  test('the home link ends where the lockup does', async ({ page }) => {
    await page.goto('/');
    await ready(page, 500);
    await page.evaluate(() => document.fonts.ready);

    const banner = page.getByRole('banner');
    const home = (await banner.getByRole('link', { name: SITE_NAME, exact: true }).boundingBox())!;
    const lockup = (await page.locator(LOCKUP).boundingBox())!;
    expect(
      Math.abs(home.x + home.width - (lockup.x + lockup.width)),
      `link right ${home.x + home.width}, lockup right ${lockup.x + lockup.width}`,
    ).toBeLessThanOrEqual(1);
  });
});

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
