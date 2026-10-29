import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/fixtures';

/**
 * The project Timeline tab on live DEMI test data for Cariboo Gold (project 45): a 2002 Act history
 * transitioned to the 2018 Act with no recorded date, a certificate in 2023 and two open amendments.
 */

const CARIBOO = '5d40cc5b4cb2c7001b1336b8';
const TIMELINE = `/p/${CARIBOO}/timeline`;
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** The list row whose `li` carries this item id. */
const row = (page: Page, id: string) =>
  page.locator(`.timeline-list > li[data-id="${id}"] .timeline-list__button`);

async function openTimeline(page: Page, search = '') {
  await page.goto(`${TIMELINE}${search}`);
  await expect(page.getByRole('list', { name: 'Timeline, oldest first' })).toBeVisible({
    timeout: 60_000,
  });
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });

  test('the summary rail links to the Timeline tab', async ({ page }) => {
    await page.goto(`/p/${CARIBOO}/overview`);
    await page.getByRole('link', { name: 'View timeline' }).click();

    await expect(page).toHaveURL(new RegExp(`/p/${CARIBOO}/timeline$`));
    await expect(page.getByRole('heading', { level: 2, name: 'Timeline' })).toBeVisible();
    await expect(page.locator('.project-tabs nav a[aria-current="page"]')).toHaveText(/^Timeline/);
  });

  test('an Act transition with no recorded date says so', async ({ page }) => {
    await openTimeline(page);

    const transition = row(page, 'transition-2002-2018');
    await expect(transition).toContainText('Transitioned to the 2018 Act');
    await expect(transition).toContainText('Date: Not recorded');
  });

  test('arrow keys move focus between rows and Enter selects', async ({ page }) => {
    await openTimeline(page);
    // The first open work is selected on arrival, so it is the row in the Tab order.
    await row(page, 'work-123').focus();

    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'work-333')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(row(page, 'work-333')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/[?&]item=work-333/);

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(row(page, 'certificate')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]item=certificate/);
    await expect(row(page, 'certificate')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, 'work-333')).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.getByRole('complementary', { name: 'Selected item' }).getByRole('heading', { level: 3 }),
    ).toHaveText('Environmental Assessment Certificate issued');
  });

  test('?item= preselects that row and opens its folded group', async ({ page }) => {
    // Pre-EA is dated by its documents; Pre-Application is the one undated 2002 phase.
    await openTimeline(page, '?item=phase-2002-pre-application');

    await expect(row(page, 'history-2002')).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, 'phase-2002-pre-application')).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('complementary', { name: 'Selected item' }).getByRole('heading', { level: 3 }),
    ).toHaveText('Pre-Application');
  });

  test('an unknown ?item= falls back to the first open work', async ({ page }) => {
    await openTimeline(page, '?item=no-such-item');

    await expect(row(page, 'work-123')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the lanes heading names the years of the list rows in view', async ({ page }) => {
    await openTimeline(page);
    const list = page.locator('.timeline-list');
    const heading = page.locator('.timeline-lanes__heading');
    const thisYear = new Date().getFullYear();

    // The top rows are the 2002 Act band (in force 30 Dec 2002) and its history.
    await list.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(heading).toHaveText(/list showing 2002 – (?!2002)\d{4}$/);

    // The bottom row is Today; the 2002 band is out of view.
    await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(heading).toHaveText(new RegExp(`list showing (?!2002)\\d{4} – ${thisYear}$`));
  });

  /** Scrolls the list to one end, then waits for the box on the lanes to finish sliding there. */
  async function scrollListTo(page: Page, end: 'top' | 'bottom') {
    const list = page.locator('.timeline-list');
    const listBox = page.locator('.timeline-lanes__window');
    await list.evaluate((element, top) => element.scrollTo({ top }), end === 'top' ? 0 : 1e6);
    await listBox.scrollIntoViewIfNeeded();
    // The box re-renders after the scroll event, then slides for 0.12s: settled once two reads agree.
    let last = NaN;
    await expect
      .poll(
        async () => {
          const x = (await listBox.boundingBox())!.x;
          const still = x === last;
          last = x;
          return still;
        },
        { intervals: [250] },
      )
      .toBe(true);
    return { list, listBox };
  }

  test('dragging the list box on the lanes, below its strip, scrolls the list', async ({
    page,
  }) => {
    await openTimeline(page);
    const { list, listBox } = await scrollListTo(page, 'top');
    await expect(list).toHaveJSProperty('scrollTop', 0);
    const box = (await listBox.boundingBox())!;
    const y = box.y + box.height * 0.75;

    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 300, y, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => (await listBox.boundingBox())!.x).toBeGreaterThan(box.x + 100);
  });

  /** The list scrolled to its end, where the work-333 bar (2023 to today) sits inside the list box. */
  async function work333InsideBox(page: Page) {
    await openTimeline(page);
    const { list, listBox } = await scrollListTo(page, 'bottom');
    const mark = page.locator('.timeline-lanes__mark--work[data-id="work-333"]');
    const box = (await listBox.boundingBox())!;
    const at = (await mark.boundingBox())!;
    expect(at.x + at.width / 2).toBeGreaterThan(box.x);
    expect(at.x + at.width / 2).toBeLessThan(box.x + box.width);
    const scrollTop = await list.evaluate((element) => element.scrollTop);
    return { list, listBox, mark, box, at, scrollTop };
  }

  test('a mark inside the list box selects its row and leaves the list where it is', async ({
    page,
  }) => {
    const { list, mark, scrollTop } = await work333InsideBox(page);

    await mark.click();

    await expect(row(page, 'work-333')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/[?&]item=work-333/);
    await expect(list).toHaveJSProperty('scrollTop', scrollTop);
  });

  test('a drag that starts on a mark inside the list box scrolls the list, not selects', async ({
    page,
  }) => {
    const { list, listBox, mark, box, at, scrollTop } = await work333InsideBox(page);
    const x = at.x + at.width / 2;
    const y = at.y + at.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 40, y, { steps: 5 });
    await page.mouse.up();

    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeLessThan(scrollTop);
    await expect.poll(async () => (await listBox.boundingBox())!.x).toBeLessThan(box.x);
    await expect(row(page, 'work-333')).toHaveAttribute('aria-pressed', 'false');
    await expect(page).not.toHaveURL(/[?&]item=/);

    await mark.click();
    await expect(row(page, 'work-333')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/[?&]item=work-333/);
  });

  test('dragging the view box on the mini-map moves the zoomed view', async ({ page }) => {
    await openTimeline(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const slider = page.getByRole('slider', { name: 'View on the whole life' });
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    // Half the mini-map is the whole way left at this zoom; the view stops at the start.
    await page.mouse.move(box.x + box.width / 2 - box.width, y, { steps: 10 });
    await page.mouse.up();

    await expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  test('a phase with over 50 documents links to all of them by phase tag', async ({ page }) => {
    await openTimeline(page, '?item=phase-6');

    const all = page
      .getByRole('complementary', { name: 'Selected item' })
      .getByRole('link', { name: /^View all \d+ documents/ });
    await expect(all).toHaveAttribute(
      'href',
      new RegExp(`^/p/${CARIBOO}/documents\\?projectPhase=[0-9a-f]{24}(%2C[0-9a-f]{24})*$`),
    );
  });
});

test.describe('the rail link brings the tab strip to the top', () => {
  test.use({ viewport: DESKTOP });

  const activeTab = (page: Page) => page.locator('.project-tabs nav a[aria-current="page"]');
  const viewTimeline = (page: Page) => page.getByRole('link', { name: 'View timeline' });
  const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
  const timelineList = (page: Page) => page.getByRole('list', { name: 'Timeline, oldest first' });

  async function clickViewTimeline(page: Page) {
    await viewTimeline(page).click();
    await expect(activeTab(page)).toHaveText(/^Timeline/);
  }

  /** From an overview whose rail has drawn its stages: they make the panel above the strip taller. */
  async function followRailLink(page: Page) {
    await page.goto(`/p/${CARIBOO}/overview`);
    await expect(page.locator('.project-panel__progress')).toContainText('Post decision');
    await clickViewTimeline(page);
  }

  async function expectTabAtTop(page: Page) {
    await expect.poll(async () => Math.round((await activeTab(page).boundingBox())!.y)).toBe(0);
  }

  async function scrollToTop(page: Page) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => scrollY(page)).toBe(0);
  }

  /** Two frames: a scroll started on arrival has moved the page by then. */
  const nextFrames = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );

  /** Every DEMI list row, read page by page before the app asks. */
  async function allLists(page: Page) {
    const rows: unknown[] = [];
    let total = Infinity;
    for (let n = 1; rows.length < total; n++) {
      const response = await page.request.get(`/demi/api/lists?page=${n}&pageSize=100&count=true`);
      const batch = (await response.json()) as unknown[];
      expect(batch.length).toBeGreaterThan(0);
      rows.push(...batch);
      total = Number(response.headers()['x-total-count']);
      expect(total).not.toBeNaN();
    }
    return rows;
  }

  /**
   * Holds the lists (rail stages) until the returned release. Then all of them arrive in one
   * answer, so the stages land within a frame or two, not one network round trip per page.
   */
  async function holdLists(page: Page) {
    const rows = await allLists(page);
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    await page.route('**/demi/api/lists**', async (route) => {
      await held;
      await route.fulfill({ json: rows, headers: { 'x-total-count': String(rows.length) } });
    });
    return release;
  }

  /** Arms a promise that `scrollStarted` waits on: the window's next scroll event. */
  const armScrollStart = (page: Page) =>
    page.evaluate(() => {
      const scrollStart = new Promise<void>((done) =>
        window.addEventListener('scroll', () => done(), { once: true }),
      );
      Object.assign(window, { scrollStart });
    });
  const scrollStarted = (page: Page) =>
    page.evaluate(() => (window as unknown as { scrollStart: Promise<void> }).scrollStart);

  test('the active tab lands at the top, focused, with no hash in the URL', async ({ page }) => {
    await followRailLink(page);

    await expectTabAtTop(page);
    await expect(activeTab(page)).toBeFocused();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('clicking the link again from the Timeline tab scrolls again', async ({ page }) => {
    await followRailLink(page);
    await expectTabAtTop(page);

    await scrollToTop(page);
    await viewTimeline(page).click();
    await expectTabAtTop(page);

    await scrollToTop(page);
    await viewTimeline(page).click();
    await expectTabAtTop(page);
  });

  // Stages that land after the scroll ends are held in place by the browser's scroll anchoring.
  test('rail stages that land during the scroll still leave the tab at the top', async ({
    page,
  }) => {
    const release = await holdLists(page);
    await page.goto(`/p/${CARIBOO}/overview`);
    await armScrollStart(page);

    await clickViewTimeline(page);
    await scrollStarted(page);
    release();
    await expect(page.locator('.project-panel__progress')).toContainText('Post decision');

    await expectTabAtTop(page);
  });

  test.describe('a reader scroll', () => {
    // Instant scrolling, so a re-aim after the stages land has finished by the next frame.
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    const tabY = async (page: Page) => Math.round((await activeTab(page).boundingBox())!.y);

    /** Clicks the rail link with the stages held, so they are still to land. */
    async function clickWithStagesHeld(page: Page) {
      const release = await holdLists(page);
      await page.goto(`/p/${CARIBOO}/overview`);
      await clickViewTimeline(page);
      await expectTabAtTop(page);
      return { release, atTop: await scrollY(page) };
    }

    // Stages land above the strip, so a re-aim would pull the tab back up toward the top.
    async function landStages(page: Page, release: () => void) {
      release();
      await expect(page.locator('.project-panel__progress')).toContainText('Post decision');
      await nextFrames(page);
    }

    test('a wheel right after the click is not pulled back', async ({ page }) => {
      const { release, atTop } = await clickWithStagesHeld(page);

      await page.mouse.wheel(0, -200);
      await expect.poll(() => scrollY(page)).toBeLessThan(atTop);
      const moved = await tabY(page);
      await landStages(page, release);

      expect(await tabY(page)).toBeGreaterThanOrEqual(moved);
    });

    test('a key press right after the click is not pulled back', async ({ page }) => {
      const { release, atTop } = await clickWithStagesHeld(page);

      await page.keyboard.press('PageUp');
      await expect.poll(() => scrollY(page)).toBeLessThan(atTop);
      const moved = await tabY(page);
      await landStages(page, release);

      expect(await tabY(page)).toBeGreaterThanOrEqual(moved);
    });

    // A script scroll fires no wheel or key event, so only the 3 s window can end the re-aim.
    test('stages that land after the re-aim window are not chased', async ({ page }) => {
      await page.clock.install();
      const { release, atTop } = await clickWithStagesHeld(page);

      await page.evaluate(() => window.scrollBy({ top: -200, behavior: 'instant' }));
      await expect.poll(() => scrollY(page)).toBeLessThan(atTop);
      const moved = await tabY(page);
      await page.clock.fastForward(3100);
      await landStages(page, release);

      expect(await tabY(page)).toBeGreaterThanOrEqual(moved);
    });
  });

  test.describe('history moves', () => {
    // Instant scrolling, so a wrong scroll on arrival has finished by the next frame.
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('a reload keeps the restored position', async ({ page }) => {
      await followRailLink(page);
      await expectTabAtTop(page);
      await scrollToTop(page);

      await page.reload();
      await expect(timelineList(page)).toBeVisible({ timeout: 60_000 });
      await nextFrames(page);

      expect(await scrollY(page)).toBe(0);
    });

    test('back then forward keeps the restored position', async ({ page }) => {
      await followRailLink(page);
      await expectTabAtTop(page);
      await scrollToTop(page);

      await page.goBack();
      await expect(activeTab(page)).toHaveText(/^Overview/);
      await page.goForward();
      await expect(activeTab(page)).toHaveText(/^Timeline/);
      await nextFrames(page);

      expect(await scrollY(page)).toBe(0);
    });
  });

  test.describe('with reduced motion', () => {
    // A phone, so the strip scrolls sideways and can hold the Timeline tab out of view.
    test.use({ viewport: PHONE, contextOptions: { reducedMotion: 'reduce' } });

    interface Jump {
      page: [number, number];
      strip: [number, number];
    }

    test('the page and the tab strip each jump in one step', async ({ page }) => {
      await page.goto(`/p/${CARIBOO}/overview`);
      const strip = page.locator('.project-tabs .nav-tabs');
      await strip.evaluate(
        (element) =>
          new Promise<void>((done) => {
            element.addEventListener('scrollend', () => done(), { once: true });
            element.scrollTo({ left: 1e6, behavior: 'instant' });
          }),
      );
      const timelineTab = page.locator('.project-tabs nav a', { hasText: 'Timeline' });
      expect((await timelineTab.boundingBox())!.x).toBeLessThan((await strip.boundingBox())!.x);
      await viewTimeline(page).scrollIntoViewIfNeeded();
      await nextFrames(page);
      // [position at the first scroll event, position at scrollend]: equal only for an instant jump.
      await strip.evaluate((element) => {
        const watch = (target: EventTarget, read: () => number) =>
          new Promise<[number, number]>((done) => {
            let first: number | undefined;
            target.addEventListener('scroll', () => (first ??= read()));
            target.addEventListener('scrollend', () => done([first!, read()]), { once: true });
          });
        const jump = Promise.all([
          watch(window, () => window.scrollY),
          watch(element, () => element.scrollLeft),
        ]).then(([page, strip]) => ({ page, strip }));
        Object.assign(window, { jump });
      });

      await viewTimeline(page).click();
      const jump = await page.evaluate(() => (window as unknown as { jump: Promise<Jump> }).jump);

      expect(jump.strip[0]).toBe(jump.strip[1]);
      expect(jump.page[0]).toBe(jump.page[1]);
      // Both arrows show, as Overview is out of view to the left and later tabs to the right.
      const leftArrow = page.getByRole('button', { name: 'Scroll tabs left' });
      const rightArrow = page.getByRole('button', { name: 'Scroll tabs right' });
      await expect(leftArrow).toBeVisible();
      await expect(rightArrow).toBeVisible();
      const [tabBox, leftBox, rightBox] = [
        (await activeTab(page).boundingBox())!,
        (await leftArrow.boundingBox())!,
        (await rightArrow.boundingBox())!,
      ];
      expect(tabBox.x).toBeGreaterThanOrEqual(leftBox.x + leftBox.width);
      expect(tabBox.x + tabBox.width).toBeLessThanOrEqual(rightBox.x);
    });
  });

  test.describe('at 1080px tall', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('a click before any project data is cached still brings the tab to the top', async ({
      page,
    }) => {
      await page.goto(`/p/${CARIBOO}/overview`);
      await clickViewTimeline(page);

      await expectTabAtTop(page);
    });
  });
});

test.describe('phone', () => {
  test.use({ viewport: PHONE });

  test('the selected row opens its details inline, and a second tap folds them', async ({
    page,
  }) => {
    await openTimeline(page, '?item=certificate');

    const certificate = page.locator('.timeline-list > li[data-id="certificate"]');
    await expect(row(page, 'certificate')).toHaveAttribute('aria-expanded', 'true');
    await expect(certificate.getByRole('heading', { level: 3 })).toHaveText(
      'Environmental Assessment Certificate issued',
    );
    // Inline only: no side panel beside the list.
    await expect(page.getByRole('complementary', { name: 'Selected item' })).toHaveCount(1);

    await row(page, 'certificate').click();
    await expect(row(page, 'certificate')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('complementary', { name: 'Selected item' })).toHaveCount(0);

    await row(page, 'phase-3').click();
    await expect(
      page.locator('.timeline-list > li[data-id="phase-3"]').getByRole('heading', { level: 3 }),
    ).toHaveText('Readiness Decision');
  });
});

for (const [name, viewport] of [
  ['1440px', DESKTOP],
  ['390px', PHONE],
] as const) {
  test(`the Timeline tab has no WCAG 2.2 A/AA axe violations at ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openTimeline(page);

    const results = await new AxeBuilder({ page })
      .include('.timeline-tab')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const found = results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    );
    expect(found).toEqual([]);
  });
}
