import { useQuery } from '@tanstack/react-query';
import { suggestQueryOptions, type SuggestItem } from 'app/api/suggest';
import type { RecordType } from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import { recordConfig } from 'app/pages/search/types';
import { useSettled } from 'app/pages/search/use-settled';

export interface Suggestions {
  /** `undefined` until the first answer for this keyword; the last answer stays up while the next loads. */
  items: SuggestItem[] | undefined;
  isError: boolean;
  /** True while `items` are the previous keyword's rows standing in for this one's. */
  isPlaceholderData: boolean;
  /** Changes whenever the shown rows can: keyword, kind, placeholder swap or refetch. */
  key: string;
}

/** Suggestions for what is typed, asked for once typing pauses and the keyword is long enough. */
export function useSuggestions(record: RecordType, text: string): Suggestions {
  const keywords = useSettled(typeaheadKeywords(text).trim(), TYPEAHEAD_DEBOUNCE_MS);
  const options = suggestQueryOptions(recordConfig(record).kind, keywords);
  const { data, isError, isPlaceholderData, dataUpdatedAt } = useQuery(options);
  const key = [...options.queryKey, isPlaceholderData, dataUpdatedAt].join('\u0000');
  // A disabled query still hands back the placeholder rows; a blank keyword shows none.
  return keywords === ''
    ? { items: undefined, isError: false, isPlaceholderData: false, key }
    : { items: data, isError, isPlaceholderData, key };
}
