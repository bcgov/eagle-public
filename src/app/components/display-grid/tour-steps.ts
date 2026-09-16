export interface TourStep {
  /** The `data-tour` value on the control this step spotlights. */
  target: string;
  title: string;
  body: string;
}

/**
 * The guided tour: each step spotlights one control and says what it is for.
 *
 * A step whose control is not on the page is skipped rather than pointed at nothing — the scope
 * switch only exists on the documents tab, and the narrow layout has no column filter row or
 * column picker at all — so the step count the card reports is counted at the time the tour runs.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    target: 'search',
    title: 'One search box',
    body: 'Search projects, the documents filed against them and the updates issued as an assessment proceeds — all at once. Results narrow as you type.',
  },
  {
    target: 'types',
    title: 'Pick a record type',
    body: 'Each tab shows how many records of that type match your search, so a type with no matches tells you where to look instead of dead-ending.',
  },
  {
    target: 'scope',
    title: 'Two ways to search documents',
    body: 'Names & details searches the metadata. Inside documents searches the text of the files and returns the matching passage with its page number.',
  },
  {
    target: 'filterrow',
    title: 'Filter by column',
    body: 'The row under the headings filters what is on screen. Pick several values in a column — each one becomes a chip you can remove on its own.',
  },
  {
    target: 'more',
    title: 'Filters that are not columns',
    body: 'More filters holds the rest of the record: exact posted-date ranges, legislation, and flags like featured documents.',
  },
  {
    target: 'columns',
    title: 'Choose your columns',
    body: 'Show only the columns you need. The link column stays, because a row with no link has no way into the record.',
  },
  {
    target: 'copy',
    title: 'Share what you are looking at',
    body: 'Your search, filters, sort and page all live in the address. Copy link to this view hands someone else the same result set.',
  },
];

/** The element a step points at, or null when the page is not showing that control. */
export function targetOf(step: TourStep): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
}

/** The steps this page can actually show, in order. What "Step N of M" counts. */
export function stepsOnPage(steps: readonly TourStep[] = TOUR_STEPS): TourStep[] {
  return steps.filter((step) => targetOf(step) !== null);
}
