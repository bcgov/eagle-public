/**
 * Computed-style expectations for the search page, read from the B.C. Design System tokens the
 * app itself imports (`src/styles.css` pulls `@bcgov/design-tokens/css/variables.css`). Each entry
 * names a token, never a value, so a token release moves the expectation with it.
 *
 * The package resolves from the repository root's `node_modules`, so the root install is needed
 * as well as the `e2e` one.
 */
import * as bc from '@bcgov/design-tokens/cjs/index.js';
import type { Page } from '@playwright/test';

import type { ControlKey } from './selectors';

type Tokens = typeof bc;
type TokenName = { [K in keyof Tokens]: Tokens[K] extends string ? K : never }[keyof Tokens];

/** `#rrggbb` as the browser computes a colour: `rgb(r, g, b)`. */
export function rgb(hex: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((pair) => parseInt(pair, 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The page's root font size in px, which every `rem` token resolves against. */
export async function rootFontPx(page: Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
}

/** An expected value as the browser computes it: `rem` becomes px, everything else passes. */
export function computed(value: string, rootPx: number): string {
  const rem = /^([\d.]+)rem$/.exec(value);
  return rem ? `${Number(rem[1]) * rootPx}px` : value;
}

/** A spacing token in CSS pixels, for position checks. */
export function spacing(token: TokenName, rootPx: number): number {
  return parseFloat(computed(bc[token], rootPx));
}

/** The parts of a typography token (`400 1rem/1.688rem 'BC Sans'`) the browser reports apart. */
function font(shorthand: string): { weight: string; size: string; family: string } {
  const match = /^(\d+) ([\d.]+rem)\/[\d.]+rem '(.+)'$/.exec(shorthand);
  if (!match) throw new Error(`not a typography token: ${shorthand}`);
  return { weight: match[1]!, size: match[2]!, family: `"${match[3]}"` };
}

const colour = (token: TokenName) => ({ token, value: rgb(bc[token]) });
const length = (token: TokenName) => ({ token, value: bc[token] });
const fontPart = (token: TokenName, part: 'weight' | 'size' | 'family') => ({
  token,
  value: font(bc[token])[part],
});
/** A value the design system has no token for, such as a border style. */
const literal = (value: string) => ({ token: null, value });

export interface StyleExpectation {
  /** Read by a person in the failure message. */
  element: string;
  /** Resolved on the app side; the design prototype is not held to these. */
  control: ControlKey;
  property: string;
  token: TokenName | null;
  /** Pass through `computed` before comparing. */
  value: string;
}

type Entry = [
  element: string,
  control: ControlKey,
  property: string,
  expected: Pick<StyleExpectation, 'token' | 'value'>,
];

const entries: Entry[] = [
  ['search input', 'searchInput', 'color', colour('typographyColorPrimary')],
  ['search input', 'searchInput', 'border-top-color', colour('themeGray50')],
  ['search input', 'searchInput', 'background-color', colour('themeGrayWhite')],
  ['search input', 'searchInput', 'border-top-left-radius', length('layoutBorderRadiusMedium')],
  ['search input', 'searchInput', 'padding-right', length('layoutPaddingMedium')],
  ['search input', 'searchInput', 'font-size', fontPart('typographyRegularBody', 'size')],
  ['search input', 'searchInput', 'font-family', fontPart('typographyRegularBody', 'family')],
  ['selected record pill', 'recordPillOn', 'color', colour('themePrimaryBlue')],
  ['selected record pill', 'recordPillOn', 'background-color', colour('themeGrayWhite')],
  [
    'selected record pill',
    'recordPillOn',
    'font-weight',
    fontPart('typographyBoldSmallBody', 'weight'),
  ],
  ['unselected record pill', 'recordPillOff', 'color', colour('themeGray30')],
  ['unselected record pill', 'recordPillOff', 'border-top-color', colour('themeGray30')],
  ['unselected record pill', 'recordPillOff', 'border-top-width', length('layoutBorderWidthSmall')],
  ['unselected record pill', 'recordPillOff', 'border-top-style', literal('solid')],
  ['unselected record pill', 'recordPillOff', 'padding-left', length('layoutPaddingSmall')],
  ['search help link', 'searchHelpLink', 'color', colour('themeGray30')],
  [
    'search help link',
    'searchHelpLink',
    'font-size',
    fontPart('typographyRegularSmallBody', 'size'),
  ],
  ['results toolbar', 'toolbar', 'background-color', colour('themeGrayWhite')],
  ['results toolbar', 'toolbar', 'border-bottom-color', colour('themeGray40')],
  ['results toolbar', 'toolbar', 'padding-left', length('layoutPaddingMedium')],
  ['results toolbar', 'toolbar', 'padding-top', length('layoutPaddingSmall')],
];

/** What `unified-search.css` and `display-grid.css` draw the search page's controls with. */
export const SEARCH_STYLES: readonly StyleExpectation[] = entries.map(
  ([element, control, property, expected]) => ({ element, control, property, ...expected }),
);

/** The search help link at rest and on hover. */
export const HELP_REST = { element: 'search help link', ...colour('themeGray30') };
export const HELP_HOVER = { element: 'search help link on hover', ...colour('themePrimaryGold') };

/** The rule under a list row. */
export const LIST_ROW_RULE = {
  element: 'list row rule',
  colour: colour('themeGray30'),
  width: length('layoutBorderWidthSmall'),
  style: literal('solid'),
};
