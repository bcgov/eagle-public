/**
 * The filter object is used to define custom filters for the search template
 * the ID is the id used by the API (milestone, etc.). Name is a display name for the UI
 * If you would like to include a date filter, specify the dateFilter object
 * options is the default array of option variables
 * selectedOptions is the current set of options that are selected
 * Group is an object that defines what vriable to group filters on, and some display params
 *
 * @export
 * @class FilterObject
 */
export class FilterObject {

  // Handlers for start and end dates if this is also has a date filter
  public startDate;
  public endDate;
  public active = false;
  constructor(
    public id: string,
    public name: string,
    public dateFilter: DateFilterObject = null,
    public options: any[] = [],
    public selectedOptions: any[] = [],
    public group: FilterGroupObject = null,
    public collection: FilterObject[] = null
  ) {
    // If we have a collection value, empty the options container so the UI doesn't
    // get confused by trying to create multiple components
    if (collection) {
      options = [];
      selectedOptions = [];
    }
  }
}

/**
 * The filter group defines a group to use for the search filter
 * name must be the variable name used in your options set
 * prefix and postfix is text you want on the UI around the name, for display only
 *
 * @export
 * @class FilterGroupObject
 */
export class FilterGroupObject {
  constructor(
    public name: string,
    public labelPrefix: string,
    public labelPostfix: string,
  ) { }
}

/**
 * DateFiterObject defines mappings to IDs used in date filters
 *
 * @export
 * @class DateFilterObject
 */
export class DateFilterObject {
  constructor(
    public startDateId: string,
    public endDateId: string
  ) { }
}
