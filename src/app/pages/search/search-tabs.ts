/**
 * The two document search views. Kept out of both pages so the dependency runs one way and neither
 * page imports the other.
 */
export const SEARCH_TABS = [
  { label: 'Documents', link: '/search' },
  { label: 'Document Content', link: '/search/content' },
];

/** The tabs to render. The content tab is gated on the CONTENT_SEARCH runtime config flag. */
export function visibleSearchTabs(
  isContentSearchEnabled: boolean,
): { label: string; link: string }[] {
  // One tab is no tab bar: with content search off there is nothing to switch between.
  return isContentSearchEnabled ? SEARCH_TABS : [];
}
