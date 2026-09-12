import type { ComponentType } from 'react';
import type {
  AdvancedField,
  GridColumn,
  GridTemplate,
  ValueOption,
} from 'app/components/display-grid/types';
import type { RecordType } from 'app/components/display-grid/use-grid-url-state';

/**
 * The shape of one record type, split from `index.ts` so the per-type files can read it without
 * importing the registry that imports them back.
 */

/** The `record` URL value, which is also the registry key. */
export type RecordId = RecordType;

/** A `List` or `Organization` row as the option builders read one. Every field is optional. */
export interface OptionSource {
  _id?: string;
  code?: string;
  name?: string;
  type?: string;
  legislation?: number | string;
}

/** demi-search's dataset name per record type. `search/counts` keys its answer by these. */
export const RECORD_DATASETS: Record<RecordId, string> = {
  projects: 'Project',
  documents: 'Document',
  activities: 'RecentActivity',
  notifications: 'ProjectNotification',
};

/** `meta[0]` of a search envelope: the totals, and what the index could not honour. */
export interface SearchMeta {
  searchResultsTotal?: number;
  /** Fields the query named that the index does not carry, so the backend ignored them. */
  dropped?: string[];
  degraded?: boolean;
}

export interface RecordTypeConfig<Row = Record<string, unknown>> {
  id: RecordId;
  label: string;
  /** demi-search `dataset=` value. */
  dataset: string;
  defaultSort: string;
  template: GridTemplate;
  columns: GridColumn<Row>[];
  /** Wire filter ids offered as column filters, in column order; each rides as `and[<id>]`. */
  filterIds: string[];
  /** The More filters panel, which carries the ids no column can show. */
  advancedFields: AdvancedField[];
  /** Dropdown values per filter id, built from the cached `List` and `Organization` reads. */
  optionsFrom: (lists: OptionSource[], orgs: OptionSource[]) => Record<string, ValueOption[]>;
  /** Whether a row has a page of its own to link to. */
  recordHasPage: boolean;
  /** Whether rows carry a selection checkbox. */
  selectable: boolean;
  /** No column headings and no filter row: the column filters move into the panel. */
  headerless: boolean;
  rowComponent?: ComponentType<{ row: Row }>;
}

/** An option's wire value is its `_id`, or its `code` for the lists that carry no id. */
export function toOptions(items: OptionSource[]): ValueOption[] {
  return items
    .map((item) => ({ value: item._id ?? item.code ?? item.name ?? '', label: item.name ?? '' }))
    .filter((option) => option.value !== '' && option.label !== '');
}
