/**
 * Filter definitions for the search filter template. `id` is the key the API filters on
 * (`and[<id>]=...`) and the key the value is stored under; `name` is the label.
 */
export class FilterObject {
  constructor(
    public id: string,
    public type: FilterType,
    public name: string,
    public filterDefinition: any,
    public itemPanelSize: number | null = null
  ) {}
}

export enum FilterType {
  DateRange = 'date-range',
  Dropdown = 'dropdown',
  MultiSelect = 'multi-select',
  Checkbox = 'check-box',
  RadioPicker = 'radio-picker',
  SliderToggle = 'slider-toggle'
}

/** Maps a date range filter onto the two URL/API params it writes. */
export class DateFilterDefinition {
  constructor(
    public startDateId: string,
    public startDateLabel = 'Start Date',
    public endDateId: string,
    public endDateLabel = 'End Date',
    public minDate = new Date('01-01-1900'),
    public maxDate = new Date()
  ) {}
}

export class FilterGroupObject {
  constructor(
    public name: string,
    public labelPrefix: string,
    public labelPostfix: string
  ) {}
}

/**
 * Typeahead multi-select. `matchId` means URL values are option `_id`/`code`s to be resolved back
 * to option objects; without it the raw URL string is kept.
 */
export class MultiSelectDefinition {
  constructor(
    public options: any[] = [],
    public selectedOptions: any[] = [],
    public group: FilterGroupObject | null = null,
    public collection: FilterObject[] | null = null,
    public matchId = false
  ) {}
}

export type FilterValues = Record<string, any>;

export interface SearchPackage {
  keywords: string;
  keywordsChanged: boolean;
  subset: string | null;
  filters: Record<string, any>;
}

/** Splits a comma-joined URL value back into the option objects the multi-select renders. */
function resolveOptions(raw: string, options: any[]): any[] {
  const wanted = decodeURIComponent(raw).split(',');
  const matched = options.filter(option => wanted.includes(option._id) || wanted.includes(option.code));
  return matched.length > 0 ? matched : wanted.filter(value => value !== '');
}

/** Seeds the filter form from URL params, mirroring the Angular form group construction. */
export function initialFilterValues(filters: FilterObject[], urlValues: FilterValues = {}): FilterValues {
  const values: FilterValues = {};

  for (const filter of filters) {
    if (filter.type === FilterType.DateRange) {
      const { startDateId, endDateId } = filter.filterDefinition;
      // Both the picker and the API use plain yyyy-mm-dd, so the URL value needs no conversion.
      if (urlValues[startDateId]) values[startDateId] = String(urlValues[startDateId]).split('T')[0];
      if (urlValues[endDateId]) values[endDateId] = String(urlValues[endDateId]).split('T')[0];
    } else if (filter.type === FilterType.MultiSelect) {
      if (urlValues[filter.id]) {
        values[filter.id] = resolveOptions(String(urlValues[filter.id]), filter.filterDefinition.options ?? []);
      } else if (filter.filterDefinition.selectedOptions?.length) {
        values[filter.id] = filter.filterDefinition.selectedOptions;
      }
    } else if (urlValues[filter.id]) {
      values[filter.id] = urlValues[filter.id];
    }
  }

  return values;
}

/** Turns the filter form values into the package the host component navigates with. */
export function buildSearchPackage(
  filters: FilterObject[],
  values: FilterValues,
  keywords: string,
  keywordsChanged: boolean
): SearchPackage {
  const searchFilters: Record<string, any> = {};

  for (const filter of filters) {
    if (filter.type === FilterType.DateRange) {
      const { startDateId, endDateId } = filter.filterDefinition;
      for (const id of [startDateId, endDateId]) {
        const value = values[id];
        if (!value) continue;
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          searchFilters[id] = date.toISOString();
        }
      }
    } else if (filter.type === FilterType.MultiSelect) {
      const selected: any[] = values[filter.id] ?? [];
      if (selected.length > 0) {
        searchFilters[filter.id] = selected.map(item => item._id ?? item.code ?? item);
      }
    } else if (values[filter.id]) {
      searchFilters[filter.id] = values[filter.id];
    }
  }

  return { keywords, keywordsChanged, subset: null, filters: searchFilters };
}

export function hasActiveFilters(values: FilterValues, keywords: string): boolean {
  if (keywords) {
    return true;
  }

  return Object.values(values).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return !!value;
  });
}
