import type { AdvancedField, GridColumn, SortState, ValueOption } from './types';

/** `-datePosted` as the header reads it. */
export function sortStateOf(sortBy: string): SortState | null {
  if (!sortBy) return null;
  return { key: sortBy.replace(/^[+-]/, ''), dir: sortBy.startsWith('-') ? 'desc' : 'asc' };
}

/** Natural order, so "Volume 2 of 9" precedes "Volume 10 of 9". Client-side comparisons only. */
export const gridCollator = new Intl.Collator(undefined, { numeric: true });

/**
 * The column filters as advanced-panel fields. Wherever no filter row shows, the panel is the only
 * place their filters can live.
 */
export function columnFiltersForPanel<Row>(columns: GridColumn<Row>[]): AdvancedField[] {
  const fields: AdvancedField[] = [];
  for (const column of columns) {
    const id = column.filterId ?? column.key;
    if (column.filter === 'text') {
      fields.push({ id, label: column.label, kind: 'text', placeholder: column.label });
      // A date column is not absorbed: the panel already carries that record's date range.
    } else if (column.filter === 'values') {
      fields.push({ id, label: column.label, kind: 'select', options: column.options ?? [] });
    }
  }
  return fields;
}

/** What follows the Act year in a group heading, the name the Angular filters gave it. */
export const ACT_TERMS_POSTFIX = ' Act Terms';

/** The heading over one Act's terms; the terms with no Act go under "Other terms". */
export function actHeading(legislation: string): string {
  return legislation ? `${legislation}${ACT_TERMS_POSTFIX}` : 'Other terms';
}

/** Whether any option names its Act, which is when the pickers group by Act. */
export function hasActs(options: ValueOption[]): boolean {
  return options.some((option) => option.legislation);
}

/** An option's words, with its Act where it has one, so a picked term says which Act it is. */
export function optionLabel(option: ValueOption): string {
  return option.legislation ? `${option.label} (${option.legislation})` : option.label;
}

export interface ActGroup {
  /** Empty for the options that carry no Act. */
  legislation: string;
  options: ValueOption[];
}

/** Options split by Act, newest first, no-Act options last; same-name terms stay apart by id. */
export function groupByAct(options: ValueOption[]): ActGroup[] {
  const groups = new Map<string, ValueOption[]>();
  for (const option of options) {
    const key = option.legislation ?? '';
    const group = groups.get(key);
    if (group) group.push(option);
    else groups.set(key, [option]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : gridCollator.compare(b, a)))
    .map(([legislation, items]) => ({ legislation, options: items }));
}
