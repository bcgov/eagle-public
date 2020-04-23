export class FilterGroupObject {
  constructor(
    public name: string,
    public labelPrefix: string,
    public labelPostfix: string,
  ) { }
}

export class FilterObject {

  // Handlers for start and end dates if this is also has a date filter
  public startDate;
  public endDate;
  constructor(
    public id: string,
    public name: string,
    public dateFilter: boolean = false,
    public options: any[],
    public selectedOptions: any[],
    public active: boolean = false,
    public group: FilterGroupObject
  ) { }
}
