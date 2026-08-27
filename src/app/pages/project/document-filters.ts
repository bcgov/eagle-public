import {
  DateFilterDefinition,
  FilterObject,
  FilterType,
  FilterGroupObject,
  MultiSelectDefinition
} from 'app/components/filters/filter-object';

/** The `List` item `type` each document filter draws its options from, and its label. */
const DOCUMENT_FILTERS: Record<string, { listType: string; label: string }> = {
  milestone: { listType: 'label', label: 'Milestone' },
  documentAuthorType: { listType: 'author', label: 'Document Author' },
  type: { listType: 'doctype', label: 'Document Type' },
  projectPhase: { listType: 'projectPhase', label: 'Project Phase' }
};

const LEGISLATION_GROUP = new FilterGroupObject('legislation', '', ' Act Terms');

export const DATE_FILTER_LIST = ['datePostedStart', 'datePostedEnd'];

/**
 * Filters for a project document tab. `panelSizes` names the filters to render, in order, mapped
 * to their column widths; `issuedDate` is the posted-date range.
 */
export function buildDocumentFilters(
  lists: any[],
  panelSizes: Record<string, number>,
  grouped = false
): FilterObject[] {
  return Object.entries(panelSizes).map(([id, size]) => {
    if (id === 'issuedDate') {
      return new FilterObject(
        id,
        FilterType.DateRange,
        '',
        new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
        size
      );
    }
    const { listType, label } = DOCUMENT_FILTERS[id];
    return new FilterObject(
      id,
      FilterType.MultiSelect,
      label,
      new MultiSelectDefinition(
        lists.filter(item => item.type === listType),
        [],
        grouped ? LEGISLATION_GROUP : null,
        null,
        true
      ),
      size
    );
  });
}

/** The non-date filter ids of a `panelSizes` map, in URL and request order. */
export function filterListFrom(panelSizes: Record<string, number>): string[] {
  return Object.keys(panelSizes).filter(id => id !== 'issuedDate');
}
