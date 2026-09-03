import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listsQueryOptions } from 'app/api/api';
import { TableList } from 'app/components/table/table-list';
import { buildSearchFilters, createSearchConfig } from './search.config';

/** Document metadata search. The content tab is `ContentSearch`, which renders a list. */
export function Search() {
  const { data: lists = [] } = useQuery(listsQueryOptions());

  const filters = useMemo(() => (lists.length > 0 ? buildSearchFilters(lists) : []), [lists]);
  const config = useMemo(() => createSearchConfig(filters, lists), [filters, lists]);

  return <TableList config={config} />;
}
