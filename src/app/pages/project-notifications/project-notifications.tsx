import { TableList } from 'app/components/table/table-list';
import { projectNotificationsConfig } from './project-notifications.config';

export function ProjectNotifications() {
  return <TableList config={projectNotificationsConfig} />;
}
