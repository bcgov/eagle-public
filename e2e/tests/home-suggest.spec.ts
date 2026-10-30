import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Locator, type Page } from '../support/fixtures';

/** The home keyword box with its suggestion list open. `/suggest` is stubbed, the rest is live. */

const PHONE = { width: 360, height: 800 };
const DESKTOP = { width: 1280, height: 800 };

/** What the stubbed `/suggest` answers per kind, and the first row's spoken name. */
const SUGGESTIONS = {
  projects: {
    label: 'Projects',
    first: 'Cedar LNG',
    items: [
      { id: 'p1', eagleId: 'cedar-lng', name: 'Cedar LNG' },
      { id: 'p2', eagleId: 'centerm', name: 'Centerm Expansion' },
    ],
  },
  documents: {
    label: 'Documents',
    first: 'Cedar LNG application, Cedar LNG',
    items: [
      {
        id: 'd1',
        displayName: 'Cedar LNG application',
        projectEagleId: 'cedar-lng',
        projectName: 'Cedar LNG',
      },
    ],
  },
  'comment-periods': {
    label: 'Comment periods',
    first: 'Cedar LNG draft decision, Cedar LNG',
    items: [
      {
        id: 'cp1',
        informationLabel: 'Cedar LNG draft decision',
        projectEagleId: 'cedar-lng',
        projectName: 'Cedar LNG',
      },
      // DEMI matched the project name; the period has no label of its own.
      {
        id: 'cp2',
        informationLabel: '',
        projectEagleId: 'centerm',
        projectName: 'Centerm Expansion',
      },
    ],
  },
} as const;

async function openSuggestions(
  page: Page,
  kind: keyof typeof SUGGESTIONS = 'projects',
): Promise<Locator> {
  await page.route(
    (url) => url.pathname.endsWith('/suggest'),
    (route) => {
      const asked = new URL(route.request().url()).searchParams.get('kind');
      const answer = SUGGESTIONS[asked as keyof typeof SUGGESTIONS];
      return route.fulfill({ json: { items: answer ? answer.items : [] } });
    },
  );
  await page.goto('/');
  const { label, first } = SUGGESTIONS[kind];
  await page.getByRole('combobox', { name: 'What to search' }).selectOption(label);
  await page.getByRole('combobox', { name: 'Search by keyword' }).fill('ce');
  const list = page.getByRole('listbox', { name: `${label} suggestions` });
  await expect(list.getByRole('option', { name: first })).toBeVisible();
  return list;
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

function overlaps(a: Awaited<ReturnType<typeof box>>, b: Awaited<ReturnType<typeof box>>) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .include('.home-search')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
}

for (const [name, viewport] of [
  ['360px', PHONE],
  ['1280px', DESKTOP],
] as const) {
  test(`the open home suggestions have no WCAG 2.2 A/AA axe violations at ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openSuggestions(page);

    expect(await axeViolations(page)).toEqual([]);
  });

  test(`the document suggestions and their note have no axe violations at ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openSuggestions(page, 'documents');
    await expect(page.getByText(/Suggestions match document names/)).toBeVisible();

    expect(await axeViolations(page)).toEqual([]);
  });

  test(`the comment period suggestions show with no note and no axe violations at ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const list = await openSuggestions(page, 'comment-periods');
    await expect(
      list.getByRole('option', { name: 'Centerm Expansion', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.search-suggest__note')).toHaveCount(0);

    expect(await axeViolations(page)).toEqual([]);
  });
}

test.describe('phone', () => {
  test.use({ viewport: PHONE });

  test('the suggestion list spans the row and leaves the picker and Search button clear', async ({
    page,
  }) => {
    await openSuggestions(page);
    // The bordered panel around the listbox and its note, not the listbox inside the border.
    const list = await box(page.locator('.search-suggest'));
    const form = page.locator('.home-search__form');
    const picker = await box(form.getByRole('combobox', { name: 'What to search' }));
    const submit = await box(form.getByRole('button', { name: 'Search' }));

    expect(list.width).toBeCloseTo((await box(form)).width, 0);
    expect(overlaps(list, picker)).toBe(false);
    expect(overlaps(list, submit)).toBe(false);
  });
});

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });

  test('the suggestion list paints above the content below the search row', async ({ page }) => {
    const list = await openSuggestions(page);
    const { x, y, width, height } = await box(list);

    const onTop = await page.evaluate(
      ([cx, cy]) => Boolean(document.elementFromPoint(cx, cy)?.closest('.search-suggest')),
      [x + width / 2, y + height / 2],
    );
    expect(onTop).toBe(true);
  });
});
