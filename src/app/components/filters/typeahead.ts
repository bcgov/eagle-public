/**
 * What "search as you type" means, shared by the keyword box and by anything that has to fire on
 * the same beat, such as the record-type counts.
 */

/** Shortest keyword worth a round trip. One character matches most of the corpus. */
export const MIN_TYPEAHEAD_LENGTH = 2;

export const TYPEAHEAD_DEBOUNCE_MS = 300;

/**
 * What a typed box searches for. Anything shorter than the minimum searches as an empty keyword:
 * backspacing to one character restores the unfiltered list instead of leaving the last results up.
 */
export function typeaheadKeywords(keywords: string): string {
  return keywords.trim().length >= MIN_TYPEAHEAD_LENGTH ? keywords : '';
}
