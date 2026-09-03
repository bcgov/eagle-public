import { ActivityCard } from 'app/components/activity-card';
import type { TableRowProps } from 'app/components/table/table-object';

export function NewsRow({ rowData }: TableRowProps) {
  return <ActivityCard rowData={rowData} tableMode />;
}
