import type { ReactNode } from 'react';

/** The Material Icons glyph that marks a project notification, in the bundled subset. */
export const NOTIFICATION_GLYPH = 'notifications_none';

/** Whether a `project-records` row is a project notification rather than a project. */
export function isNotification(row: object & { recordKind?: unknown }): boolean {
  return row['recordKind'] === 'notification';
}

/** The icon set after a notification's name, so it reads apart from a full project. */
export function notificationMark(row: Record<string, unknown>): ReactNode {
  return isNotification(row) ? (
    <i
      className="material-icons notification-mark"
      role="img"
      aria-label="Project notification"
      title="Project notification"
    >
      {NOTIFICATION_GLYPH}
    </i>
  ) : null;
}
