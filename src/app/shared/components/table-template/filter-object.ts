export class FilterGroupObject {
  constructor(
    public name: string,
    public labelPrefix: string,
    public labelPostfix: string,
  ) { }
}

export class DateFilterObject {
  constructor(
    public startDateId: string,
    public endDateId: string
  ) { }
}

export class FilterObject {

  // Handlers for start and end dates if this is also has a date filter
  public startDate;
  public endDate;
  public active = false;
  constructor(
    public id: string,
    public name: string,
    public dateFilter: DateFilterObject,
    public options: any[],
    public selectedOptions: any[],
    public group: FilterGroupObject
  ) { }
}
