import type { AdvancedField, GridColumn } from './types';

/** Natural order, so "Volume 2 of 9" precedes "Volume 10 of 9". Client-side comparisons only. */
export const gridCollator = new Intl.Collator(undefined, { numeric: true });

/**
 * The column filters as advanced-panel fields. In list and headerless modes no column is on
 * screen, so the panel is the only place their filters can live.
 */
export function columnFiltersForPanel<Row>(columns: GridColumn<Row>[]): AdvancedField[] {
  const fields: AdvancedField[] = [];
  for (const column of columns) {
    const id = column.filterId ?? column.key;
    if (column.filter === 'text') {
      fields.push({ id, label: column.label, kind: 'text', placeholder: column.label });
    } else if (column.filter === 'year' || column.filter === 'values') {
      fields.push({ id, label: column.label, kind: 'select', options: column.options ?? [] });
    }
  }
  return fields;
}
