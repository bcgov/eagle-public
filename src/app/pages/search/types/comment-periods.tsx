/* eslint-disable react-refresh/only-export-components -- a record type is its config and the row
   that draws it, as in activities.tsx. */
import { statusLabel } from 'app/api/commentperiod';
import { ListRow } from 'app/components/display-grid/list-row';
import type { SortOption } from 'app/components/display-grid/display-grid';
import type { ValueOption } from 'app/components/display-grid/types';
import {
  engageUrl,
  fromNativePeriod,
  type NativePeriod,
  periodDates,
  periodDetailsHref,
  periodLabel,
  periodName,
} from 'app/models/commentperiod';
import type { RecordTypeConfig } from './record-type';

/** A period has two dates to sort by; the grid's own choices cover only the first. */
const SORT_OPTIONS: SortOption[] = [
  { value: '-dateStarted', label: 'Newest first' },
  { value: '+dateStarted', label: 'Oldest first' },
  { value: '+dateCompleted', label: 'Closing date, oldest first' },
  { value: '-dateCompleted', label: 'Closing date, newest first' },
];

/** DEMI takes these three `status` values and answers 400 for any other. */
const STATUS_OPTIONS: ValueOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed', label: 'Closed' },
];

/** One period as a full-width row: its status, then its project and dates as the link. */
export function CommentPeriodRow({ row }: { row: Record<string, unknown> }) {
  const period = fromNativePeriod(row as NativePeriod);
  const status = statusLabel(period);
  const dates = periodDates(period);
  // The dates are in the link so two periods of one project do not share a link name.
  const title = dates ? `${periodName(period)}: ${dates}` : periodName(period);

  // Same destination as the home rail: ENGAGE-hosted periods open on ENGAGE in a new tab.
  const engage = engageUrl(period);

  return (
    <ListRow
      meta={status ? [status] : []}
      title={title}
      href={engage ?? periodDetailsHref(period) ?? undefined}
      external={!!engage}
      body={periodLabel(period) || undefined}
    />
  );
}

/** Comment periods across every project, open, upcoming and closed alike. */
export const commentPeriodsConfig: RecordTypeConfig = {
  id: 'commentPeriods',
  label: 'Comment periods',
  noun: 'comment periods',
  kind: 'comment-periods',
  wire: { status: 'status' },
  // `/comment-periods` matches `q` as a plain substring, with no score to rank by.
  scored: false,
  // Newest period first, the order a project's own engagement list uses.
  defaultSort: '-dateStarted',
  template: 'list',
  // The row draws itself and SORT_OPTIONS names the orders, so no column is read.
  columns: [],
  sortOptions: SORT_OPTIONS,
  advancedFields: [{ id: 'status', label: 'Status', kind: 'select' }],
  optionsFrom: () => ({ status: STATUS_OPTIONS }),
  selectable: false,
  rowComponent: CommentPeriodRow,
};
