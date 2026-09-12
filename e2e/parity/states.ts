/**
 * The states the parity gate compares, as data.
 *
 * The reference capture replays these steps against the design prototype and the parity spec
 * replays the identical list against the built /search page. Neither file holds a selector: they
 * both resolve `control` through `selectors.ts`, so a step list is side-agnostic by construction.
 */
import type { ControlKey } from './selectors';

export type Step =
  | { do: 'click'; control: ControlKey }
  | { do: 'fill'; control: ControlKey; value: string }
  | { do: 'waitFor'; control: ControlKey };

/**
 * Something a viewer can see, checked on both sides. `boxHeight`/`minHeight`/`boxMinWidth` read
 * `boundingBox()`; the rest read `getComputedStyle`. `styleVar` compares against the value the
 * browser resolves the named design token to, so a token that moves moves both sides together.
 */
export type Measurement =
  | { kind: 'boxHeight'; control: ControlKey; px: number }
  | { kind: 'boxMinWidth'; control: ControlKey; px: number }
  | { kind: 'minHeight'; control: ControlKey; px: number }
  | { kind: 'styleContains'; control: ControlKey; property: string; contains: string }
  | { kind: 'styleVar'; control: ControlKey; property: string; variable: string }
  | { kind: 'zIndexAbove'; control: ControlKey; floor: number };

export interface ParityState {
  /** File-name stem: `<id>-<width>.png`. */
  id: string;
  description: string;
  steps: Step[];
  /** Checked at every width the state is captured at. */
  measurements: Measurement[];
  /**
   * Checked only at the wide width. The narrow layout replaces the table with record cards, so a
   * table or column-filter measurement has nothing to read there.
   */
  wideMeasurements?: Measurement[];
  /** Defaults to both widths. A state the narrow layout has no equivalent for names one. */
  widths?: readonly number[];
  /**
   * A selector the state's feature puts on the page at load. Absent from the page means the phase
   * that owns the feature has not been built, and the state skips rather than times out.
   */
  requires?: string;
}

/** The two widths the design is specified at: the desktop grid and the narrow list fallback. */
export const WIDTHS = [924, 400] as const;
export const WIDE = 924;

/** Frozen so date columns and "today" copy never drift a screenshot. */
export const FIXED_NOW = Date.UTC(2026, 8, 12);

/** Present in every state at every width. */
const ALWAYS: Measurement[] = [
  { kind: 'boxHeight', control: 'searchInput', px: 48 },
  { kind: 'minHeight', control: 'toolbar', px: 56 },
];

/** Present only where the table renders. */
const GRID_ONLY: Measurement[] = [{ kind: 'boxMinWidth', control: 'resultsTable', px: 880 }];

/** The search help entry point, which the dialog and every tour step are reached through. Phase 5. */
const HELP_AND_TOUR = '[data-help]';

/** Every tour step draws the same card and the same ring around whatever it points at. */
const TOUR_MEASUREMENTS: Measurement[] = [
  { kind: 'zIndexAbove', control: 'tourCard', floor: 1005 },
  { kind: 'zIndexAbove', control: 'tourRing', floor: 1005 },
  { kind: 'styleContains', control: 'tourRing', property: 'box-shadow', contains: '3px' },
  { kind: 'styleVar', control: 'tourRing', property: 'box-shadow', variable: '--theme-gold-90' },
];

export const STATES: ParityState[] = [
  {
    id: '01-documents-grid',
    description: 'Default view: documents, newest first.',
    steps: [],
    measurements: ALWAYS,
    wideMeasurements: [
      ...GRID_ONLY,
      { kind: 'boxHeight', control: 'filterPickDocumentType', px: 30 },
      { kind: 'styleContains', control: 'sortedHeader', property: 'box-shadow', contains: 'inset' },
      { kind: 'styleContains', control: 'sortedHeader', property: 'box-shadow', contains: '-2px' },
    ],
  },
  {
    id: '02-projects-grid',
    description: 'Projects tab.',
    steps: [{ do: 'click', control: 'tabProjects' }],
    measurements: ALWAYS,
    wideMeasurements: GRID_ONLY,
  },
  {
    id: '03-activities-list',
    description: 'Activities & updates, which render as a record list rather than a grid.',
    // Phase 3.
    requires: '.display-grid__list',
    steps: [{ do: 'click', control: 'tabActivities' }],
    measurements: ALWAYS,
  },
  {
    id: '04-document-content-search',
    description: 'Scope switched to Inside documents with the keyword "sediment".',
    // Phase 4.
    requires: '[data-tour="scope"] button:has-text("Inside documents")',
    steps: [
      { do: 'click', control: 'scopeInside' },
      { do: 'fill', control: 'searchInput', value: 'sediment' },
      { do: 'waitFor', control: 'highlightMark' },
    ],
    measurements: [
      ...ALWAYS,
      {
        kind: 'styleVar',
        control: 'highlightMark',
        property: 'background-color',
        variable: '--theme-gold-40',
      },
      {
        kind: 'styleVar',
        control: 'chipRow',
        property: 'background-color',
        variable: '--theme-blue-10',
      },
    ],
  },
  {
    id: '05-advanced-filters',
    description: 'More filters panel open.',
    steps: [{ do: 'click', control: 'moreFilters' }],
    measurements: [...ALWAYS, { kind: 'boxHeight', control: 'moreFilters', px: 36 }],
  },
  {
    id: '06-multiselect-picker',
    description: 'Document type column filter menu open.',
    // The column filter row belongs to the table; the narrow layout has no equivalent control.
    widths: [WIDE],
    steps: [{ do: 'click', control: 'filterPickDocumentType' }],
    measurements: [...ALWAYS, { kind: 'boxHeight', control: 'filterPickDocumentType', px: 30 }],
  },
  {
    id: '07-search-help-modal',
    description: 'Search help dialog.',
    requires: HELP_AND_TOUR,
    steps: [
      { do: 'click', control: 'searchHelpLink' },
      { do: 'waitFor', control: 'helpDialog' },
    ],
    measurements: [{ kind: 'zIndexAbove', control: 'helpDialog', floor: 1005 }],
  },
  {
    id: '08-guided-tour-step-1',
    description: 'Guided tour, first step, started from the help dialog.',
    requires: HELP_AND_TOUR,
    steps: [
      { do: 'click', control: 'searchHelpLink' },
      { do: 'waitFor', control: 'helpDialog' },
      { do: 'click', control: 'startTour' },
      { do: 'waitFor', control: 'tourCard' },
    ],
    measurements: TOUR_MEASUREMENTS,
  },
  ...tourSteps(),
  {
    id: '15-selected-state',
    description: 'Two documents checked, so the toolbar shows the selection ground.',
    // Batch selection is a table affordance; the narrow layout has no row checkboxes.
    widths: [WIDE],
    steps: [
      { do: 'click', control: 'rowSelect1' },
      { do: 'click', control: 'rowSelect2' },
    ],
    measurements: [
      ...ALWAYS,
      {
        kind: 'styleVar',
        control: 'toolbar',
        property: 'background-color',
        variable: '--theme-blue-10',
      },
    ],
  },
  {
    id: '16-empty-state',
    description: 'A keyword nothing matches.',
    steps: [
      { do: 'fill', control: 'searchInput', value: 'zzzz' },
      { do: 'waitFor', control: 'emptyState' },
    ],
    measurements: [
      ...ALWAYS,
      {
        kind: 'styleVar',
        control: 'chipRow',
        property: 'background-color',
        variable: '--theme-blue-10',
      },
    ],
  },
  {
    id: '17-copy-link-confirm',
    description: 'Copy link to this view, immediately after the click, while it confirms.',
    steps: [{ do: 'click', control: 'copyLink' }],
    measurements: ALWAYS,
  },
];

/**
 * Tour steps 2-7 differ only by how many times Next has been pressed.
 *
 * Wide width only: the tour skips any step whose anchor is not rendered, and the narrow layout
 * drops several anchors, so the step numbers do not line up there.
 */
function tourSteps(): ParityState[] {
  const openTour: Step[] = [
    { do: 'click', control: 'searchHelpLink' },
    { do: 'waitFor', control: 'helpDialog' },
    { do: 'click', control: 'startTour' },
    { do: 'waitFor', control: 'tourCard' },
  ];
  const states: ParityState[] = [];
  for (let step = 2; step <= 7; step += 1) {
    states.push({
      id: `${String(step + 7).padStart(2, '0')}-tour-step-${step}`,
      description: `Guided tour, step ${step} of 7.`,
      requires: HELP_AND_TOUR,
      widths: step >= 6 ? [WIDE] : undefined,
      steps: [
        ...openTour,
        ...Array.from({ length: step - 1 }, () => ({ do: 'click', control: 'tourNext' }) as Step),
      ],
      measurements: TOUR_MEASUREMENTS,
    });
  }
  return states;
}

export function widthsFor(state: ParityState): readonly number[] {
  return state.widths ?? WIDTHS;
}

export function measurementsFor(state: ParityState, width: number): Measurement[] {
  return width === WIDE
    ? [...state.measurements, ...(state.wideMeasurements ?? [])]
    : state.measurements;
}

export function stateById(id: string): ParityState {
  const found = STATES.find((state) => state.id === id);
  if (!found) throw new Error(`no parity state named ${id}`);
  return found;
}
