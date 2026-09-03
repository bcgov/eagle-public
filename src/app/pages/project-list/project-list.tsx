import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listsQueryOptions } from 'app/config/config';
import { proponentsQueryOptions } from 'app/api/org';
import { TableList } from 'app/components/table/table-list';
import { buildProjectListFilters, createProjectListConfig } from './project-list.config';

export function ProjectList() {
  const { data: proponents = [] } = useQuery(proponentsQueryOptions());
  const { data: lists = [] } = useQuery(listsQueryOptions());

  const filters = useMemo(
    () =>
      proponents.length > 0 && lists.length > 0 ? buildProjectListFilters(proponents, lists) : [],
    [proponents, lists],
  );

  const config = useMemo(() => createProjectListConfig(filters), [filters]);

  return <TableList config={config} />;
}
