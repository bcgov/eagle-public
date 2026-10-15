import type { ComponentType } from 'react';
import type { SortOption } from 'app/components/display-grid/display-grid';
import type {
  AdvancedField,
  GridColumn,
  GridTemplate,
  ValueOption,
} from 'app/components/display-grid/types';
import type { RecordType } from 'app/components/display-grid/use-grid-url-state';
import type { SearchKind } from 'app/api/unified-search';

/**
 * The shape of one record type, split from `index.ts` so the per-type files can read it without
 * importing the registry that imports them back.
 */

/** The `record` URL value, which is also the registry key. */
export type RecordId = RecordType;

/**
 * A `List` or `Organization` row as the option builders read one, keyed by the native `id`. Every
 * field is optional.
 */
export interface OptionSource {
  id?: string;
  code?: string;
  name?: string;
  type?: string;
  legislation?: number | string;
}

export interface SearchColumn<Row = Record<string, unknown>> extends GridColumn<Row> {
  /** The `sort=` name DEMI takes where it differs from the key: a field nested in the record. */
  sortKey?: string;
}

export interface RecordTypeConfig<Row = Record<string, unknown>> {
  id: RecordId;
  label: string;
  /**
   * What a count or an empty line calls these records: "10 of 24 updates". The tab label is the
   * fallback, and reads as a heading rather than as a noun in a sentence for the types that set
   * this.
   */
  noun?: string;
  /** The DEMI native list the tab reads. */
  kind: SearchKind;
  /**
   * URL filter id to the native query name it is sent as. A filter not named here is neither
   * offered nor sent: DEMI answers 400 for a parameter its list does not take.
   */
  wire: Record<string, string>;
  /** Per URL filter id, the options whose label is sent in place of the id the URL holds. */
  wireLabels?: (orgs: OptionSource[]) => Record<string, ValueOption[]>;
  /** False where the native list takes no `q`; the page then hides the keyword box. */
  keyword?: boolean;
  defaultSort: string;
  /** The sort select's choices, where the grid's own newest, oldest and name pair is not enough. */
  sortOptions?: SortOption[];
  template: GridTemplate;
  columns: SearchColumn<Row>[];
  /** The More filters panel, which carries the ids no column can show. */
  advancedFields: AdvancedField[];
  /** Dropdown values per filter id, built from the cached `List` and `Organization` reads. */
  optionsFrom: (lists: OptionSource[], orgs: OptionSource[]) => Record<string, ValueOption[]>;
  /** Dropdown values read off the page's own rows, for a filter whose values no lookup lists. */
  optionsFromRows?: (rows: Row[]) => Record<string, ValueOption[]>;
  /** Whether rows carry a selection checkbox. */
  selectable: boolean;
  rowComponent?: ComponentType<{ row: Row }>;
}

/** Wire value is the row's id, else `code`; a `List` row keeps its Act to tell same-name terms apart. */
export function toOptions(items: OptionSource[]): ValueOption[] {
  return items
    .map((item) => ({
      value: item.id ?? item.code ?? item.name ?? '',
      label: item.name ?? '',
      ...(item.legislation ? { legislation: String(item.legislation) } : {}),
    }))
    .filter((option) => option.value !== '' && option.label !== '');
}
