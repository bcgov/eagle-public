import { searchPage } from 'app/api/unified-search';
import { parseGridParams } from 'app/components/display-grid/use-grid-url-state';
import { capturedRequestUrl } from '../../../../../test-utils';
import { toNativeFilters } from '../../search-filters';
import type { OptionSource, RecordTypeConfig } from '../record-type';

/**
 * The query a tab sends for the keyword and filters an address holds, built as the page builds it:
 * each URL id under its native name, an old link's year as the range it stands for.
 */
export async function nativeQueryFor(
  config: RecordTypeConfig,
  address: string | Record<string, string>,
  { sort, orgs = [] }: { sort?: string; orgs?: OptionSource[] } = {},
): Promise<URLSearchParams> {
  const idsOf = (kind: 'date' | 'text') =>
    config.columns
      .filter((column) => column.filter === kind)
      .map((column) => column.filterId ?? column.key);
  const { keywords, filters } = parseGridParams(new URLSearchParams(address), {
    dateFilterIds: idsOf('date'),
  });
  const url = await capturedRequestUrl(() =>
    searchPage(config.kind, {
      page: 1,
      pageSize: 25,
      sort,
      q: keywords || undefined,
      filters: toNativeFilters(filters, config.wire, config.wireLabels?.(orgs), idsOf('text')),
    }),
  );
  return new URL(url, 'http://localhost').searchParams;
}
