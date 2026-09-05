interface BuildNature {
  build: string;
  nature: string;
}

export class Constants {
  /** The API's stand-in for "no date": a document with no posting date. Never rendered. */
  public static readonly NO_DATE = '1900-01-01T08:00:00.000Z';

  /** Where a Regulatory Transfer project points when its regulation row carries no link. */
  public static readonly BC_ENERGY_REGULATOR_LINK =
    'https://www.bc-er.ca/data-reports/data-centre/';

  public static readonly searchDisclaimer =
    'Note: Some documents within this project have not yet been categorized by author, document type, and/or milestone and may not be displayed when using some of the search filters. We are actively processing these documents so they can be searched and filtered, making it easier to find what you’re looking for. Clearing the filters and searching based on a keyword will show all results.';
  public static readonly docSearchDisclaimer =
    'Note: Some documents have not yet been categorized by author, document type, and/or milestone and may not be displayed when using some of the search filters. We are actively processing these documents so they can be searched and filtered, making it easier to find what you’re looking for. Clearing the filters and searching based on a keyword will show all results.';

  public static readonly optionalProjectDocTabs = {
    APPLICATION: 'application',
    CERTIFICATE: 'certificate',
    AMENDMENT: 'amendment',
    COMPLIANCE: 'compliance',
    UNSUBSCRIBE_CAC: 'project-unsubscribe',
  };

  public static readonly legislationLinks = {
    ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK:
      'http://www.bclaws.ca/civix/document/id/complete/statreg/02043_01',
    ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK:
      'http://www.bclaws.ca/civix/document/id/complete/statreg/96119_pit',
    ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK:
      'http://www.bclaws.ca/civix/document/id/complete/statreg/18051',
  };

  public static readonly tableDefaults = {
    DEFAULT_CURRENT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    DEFAULT_SORT_BY: '-datePosted',
    DEFAULT_KEYWORDS: '',
    DEFAULT_SHOW_MORE_INCREMENT: 5,
    DEFAULT_DATASET: '',
    MAX_SHOW_ALL_ITEMS: 500,
    DEFAULT_PAGE_SIZE_OPTIONS: [
      { displayText: '10', value: 10 },
      { displayText: '25', value: 25 },
      { displayText: '50', value: 50 },
      { displayText: '100', value: 100 },
    ],
  };

  public static readonly PCP_COLLECTION: object[] = [
    { code: 'none', name: 'None' },
    { code: 'pending', name: 'Upcoming' },
    { code: 'open', name: 'Open' },
    { code: 'closed', name: 'Closed' },
  ];

  public static readonly PROJECT_TYPE_COLLECTION: object[] = [
    { code: 'energyElectricity', name: 'Energy-Electricity' },
    { code: 'energyPetroleum', name: 'Energy-Petroleum & Natural Gas' },
    { code: 'foodProcessing', name: 'Food Processing' },
    { code: 'industrial', name: 'Industrial' },
    { code: 'mines', name: 'Mines' },
    { code: 'other', name: 'Other' },
    { code: 'tourist', name: 'Tourist Destination Resorts' },
    { code: 'transportation', name: 'Transportation' },
    { code: 'wasteDisposal', name: 'Waste Disposal' },
    { code: 'waterManagement', name: 'Water Management' },
  ];

  // TODO: At the moment, filters use the type name to communicate with the api.
  // This will be removed when project type code is put in the root of the project
  public static readonly TEMPORARY_PROJECT_TYPE = [
    { code: 'Energy-Electricity', name: 'Energy-Electricity' },
    { code: 'Energy-Petroleum & Natural Gas', name: 'Energy-Petroleum & Natural Gas' },
    { code: 'Food Processing', name: 'Food Processing' },
    { code: 'Industrial', name: 'Industrial' },
    { code: 'Mines', name: 'Mines' },
    { code: 'Other', name: 'Other' },
    { code: 'Tourist Destination Resorts', name: 'Tourist Destination Resorts' },
    { code: 'Transportation', name: 'Transportation' },
    { code: 'Waste Disposal', name: 'Waste Disposal' },
    { code: 'Water Management', name: 'Water Management' },
  ];

  public static readonly REGIONS_COLLECTION: object[] = [
    { code: 'Cariboo', name: 'Cariboo' },
    { code: 'Kootenay', name: 'Kootenay' },
    { code: 'Lower Mainland', name: 'Lower Mainland' },
    { code: 'Okanagan', name: 'Okanagan' },
    { code: 'Omineca', name: 'Omineca' },
    { code: 'Peace', name: 'Peace' },
    { code: 'Skeena', name: 'Skeena' },
    { code: 'Thompson-Nicola', name: 'Thompson-Nicola' },
    { code: 'Vancouver Island', name: 'Vancouver Island' },
  ];

  public static readonly PROJECT_NOTIFICATION_DECISIONS: object[] = [
    { code: 'In Progress', name: 'In Progress' },
    { code: 'Referred for s.11 consideration', name: 'Referred for s.11 consideration' },
    { code: 'Not referred for s.11 consideration', name: 'Not referred for s.11 consideration' },
  ];

  public static readonly buildToNature: BuildNature[] = [
    {
      build: 'new',
      nature: 'New Construction',
    },
    {
      build: 'modification',
      nature: 'Modification of Existing',
    },
    {
      build: 'dismantling',
      nature: 'Dismantling or Abandonment',
    },
  ];
}
