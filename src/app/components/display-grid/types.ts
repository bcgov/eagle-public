import type { ReactNode } from 'react';
export type GridTemplate = 'grid' | 'list';
export type ColumnFilter = 'text' | 'year' | 'values' | null;
export interface ValueOption {
  value: string;
  label: string;
  /** The Act year a `List` term belongs to. Both Acts hold terms with the same name. */
  legislation?: string;
}
export interface GridColumn<Row = unknown> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  filter?: ColumnFilter;
  filterId?: string;
  /** A line under the filter, in the panel and the header popover, read with it. */
  filterHint?: string;
  link?: boolean;
  /** Where one record's link column points. No target leaves the name as plain text. */
  href?: (row: Row) => string | undefined;
  /** The target leaves the app — a file download, say — so it opens as a plain anchor. */
  hrefExternal?: boolean | ((row: Row) => boolean);
  /** Runs instead of following the href: a download that asks for a presigned URL first. */
  onLinkClick?: (row: Row) => void;
  /** That click opens a new tab for this row, so the link announces one. */
  linkOpensTab?: (row: Row) => boolean;
  /** Drawn before the value, inside its link, for a marker the record carries: a featured star. */
  badge?: (row: Row) => ReactNode;
  /** Draws the badge after the value instead, as the notification bell is. */
  badgeAfter?: boolean;
  locked?: boolean;
  /** Starts switched off. The column picker still lists it, so the reader can turn it on. */
  defaultHidden?: boolean;
  date?: boolean;
  primaryDate?: boolean;
  render?: (row: Row) => ReactNode;
  options?: ValueOption[];
}
export type AdvancedFieldKind = 'date' | 'select' | 'toggle' | 'text';
interface AdvancedFieldBase {
  id: string;
  label: string;
  options?: ValueOption[];
  placeholder?: string;
}
export type AdvancedField =
  /** `hint` is a line under the control, read with it. */
  | (AdvancedFieldBase & { kind: 'select' | 'date'; hint?: string })
  | (AdvancedFieldBase & { kind: 'toggle' | 'text'; hint?: never });
export type FilterValue = string | string[];
export type FilterValues = Record<string, FilterValue>;
export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}
