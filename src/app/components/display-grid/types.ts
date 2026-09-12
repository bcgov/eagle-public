import type { ReactNode } from 'react';
export type GridTemplate = 'grid' | 'list';
export type ColumnFilter = 'text' | 'year' | 'values' | null;
export interface ValueOption {
  value: string;
  label: string;
}
export interface GridColumn<Row = unknown> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  filter?: ColumnFilter;
  filterId?: string;
  link?: boolean;
  /** Where one record's link column points. No target leaves the name as plain text. */
  href?: (row: Row) => string | undefined;
  /** The target leaves the app — a file download, say — so it opens as a plain anchor. */
  hrefExternal?: boolean;
  locked?: boolean;
  date?: boolean;
  primaryDate?: boolean;
  render?: (row: Row) => ReactNode;
  options?: ValueOption[];
}
export type AdvancedFieldKind = 'date' | 'select' | 'toggle' | 'text';
export interface AdvancedField {
  id: string;
  label: string;
  kind: AdvancedFieldKind;
  options?: ValueOption[];
  placeholder?: string;
}
export type FilterValue = string | string[];
export type FilterValues = Record<string, FilterValue>;
export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}
