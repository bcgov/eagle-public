import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

export interface BuildNature {
  build: string;
  nature: string;
}

export class Constants {

  public static readonly minPickerDate: NgbDateStruct = { year: 1900, month: 1, day: 1 };
  public static readonly maxPickerDate: NgbDateStruct = { year: (new Date().getFullYear() + 20), month: 1, day: 1 };

  public static readonly searchDisclaimer = 'Note: Some documents within this project have not yet been categorized by author, document type, and/or milestone and may not be displayed when using some of the search filters. We are actively processing these documents so they can be searched and filtered, making it easier to find what you’re looking for. Clearing the filters and searching based on a keyword will show all results.';
  public static readonly docSearchDisclaimer = 'Note: Some documents have not yet been categorized by author, document type, and/or milestone and may not be displayed when using some of the search filters. We are actively processing these documents so they can be searched and filtered, making it easier to find what you’re looking for. Clearing the filters and searching based on a keyword will show all results.';

  public static readonly optionalProjectDocTabs = {
    APPLICATION: 'application',
    CERTIFICATE: 'certificate',
    AMENDMENT: 'amendment',
    UNSUBSCRIBE_CAC: 'project-unsubscribe'
  };

  public static readonly legislationLinks = {
    ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK: 'http://www.bclaws.ca/civix/document/id/complete/statreg/02043_01',
    ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK: 'http://www.bclaws.ca/civix/document/id/complete/statreg/96119_pit',
    ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK: 'http://www.bclaws.ca/civix/document/id/complete/statreg/18051'
  };

  public static readonly tableDefaults = {
    DEFAULT_CURRENT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    DEFAULT_SORT_BY: '-datePosted',
    DEFAULT_KEYWORDS: '',
    DEFAULT_SHOW_MORE_INCREMENT: 5
  };

  public static readonly PCP_COLLECTION: object[] = [
    { code: 'pending', name: 'Pending' },
    { code: 'open', name: 'Open' },
    { code: 'closed', name: 'Closed' }
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
    { code: 'waterManagement', name: 'Water Management' }
  ];

  public static readonly REGIONS_COLLECTION: Array<object> = [
    { code: 'Cariboo', name: 'Cariboo' },
    { code: 'Kootenay', name: 'Kootenay' },
    { code: 'Lower Mainland', name: 'Lower Mainland' },
    { code: 'Okanagan', name: 'Okanagan' },
    { code: 'Omineca', name: 'Omineca' },
    { code: 'Peace', name: 'Peace' },
    { code: 'Skeena', name: 'Skeena' },
    { code: 'Thompson-Nicola', name: 'Thompson-Nicola' },
    { code: 'Vancouver Island', name: 'Vancouver Island' }
  ];

  public static readonly PROJECT_NOTIFICATION_DECISIONS: Array<object> = [
    { code: 'In Progress', name: 'In Progress' },
    { code: 'Referred for s.11 consideration', name: 'Referred for s.11 consideration' },
    { code: 'Not referred for s.11 consideration', name: 'Not referred for s.11 consideration' }
  ];

  public static readonly buildToNature: BuildNature[] = [
    { build: 'new',
      nature: 'New Construction'
    },
    { build: 'modification',
      nature: 'Modification of Existing'
    },
    { build: 'dismantling',
      nature: 'Dismantling or Abandonment'
    },
  ];

  public static readonly types = [
    'CERTIFICATE OF PURCHASE',
    'CROWN GRANT',
    'DEVELOPMENT AGREEMENT',
    'DOMINION PATENTS',
    'INCLUSION',
    'INVENTORY',
    'LEASE',
    'LICENCE',
    'OIC ECOLOGICAL RESERVE ACT',
    'PERMIT',
    'PRE-TANTALIS',
    'PROVINCIAL PARK',
    'RESERVE/NOTATION',
    'REVENUE SHARING AGREEMENT',
    'RIGHT-OF-WAY',
    'TRANSFER OF ADMINISTRATION/CONTROL'
  ];

  public static readonly subtypes = {
    'CERTIFICATE OF PURCHASE': [
      'DIRECT SALE',
      'FROM LEASE-PURCHASE OPTION',
      'PRE-TANTALIS CERTIFICATE OF PURCHASE',
      'TEMPORARY CODE'
    ],
    'CROWN GRANT': [
      'DIRECT SALE',
      'FREE CROWN GRANT',
      'FROM LEASE-PURCHASE OPTION',
      'HISTORIC',
      'HISTORIC CROWN GRANT',
      'LAND EXCHANGE',
      'PRE-EMPTION',
      'PRE-TANTALIS CROWN GRANT',
      'TEMPORARY CODE'
    ],
    'DEVELOPMENT AGREEMENT': [
      'ALPINE SKI DEVELOPMENT',
      'PRE-TANTALIS DEVELOPMENTAL AGREEMENT'
    ],
    'DOMINION PATENTS': [
      'PRE-TANTALIS DOMINION PATENTS'
    ],
    'INCLUSION': [
      'ACCESS',
      'AGREEMENT',
      'INCLUSION',
      'LAND TITLE ACT ACCRETION',
      'LAND TITLE ACT BOUNDARY ADJUSTMENT',
      'PRE-TANTALIS INCLUSION'
    ],
    'INVENTORY': [
      'BCAL INVENTORY'
    ],
    'LEASE': [
      'HEAD LEASE',
      'LEASE - PURCHASE OPTION',
      'PRE-TANTALIS LEASE',
      'STANDARD LEASE'
    ],
    'LICENCE': [
      'LICENCE OF OCCUPATION',
      'PRE-TANTALIS LICENCE'
    ],
    'OIC ECOLOGICAL RESERVE ACT': [
      'OIC ECOLOGICAL RESERVES',
      'PRE-TANTALIS OIC ECO RESERVE'
    ],
    'PERMIT': [
      'INVESTIGATIVE PERMIT',
      'PRE-TANTALIS PERMIT',
      'ROADS & BRIDGES',
      'TEMPORARY CODE',
      'TEMPORARY PERMIT'
    ],
    'PRE-TANTALIS': [
      'PRE-TANTALIS'
    ],
    'PROVINCIAL PARK': [
      'PARKS',
      'PRE-TANTALIS PARKS',
      'PRE-TANTALIS PARKS (00 ON TAS/CLR)'
    ],
    'RESERVE/NOTATION': [
      'DESIGNATED USE AREA',
      'MAP RESERVE',
      'NOTATION OF INTEREST',
      'OIC RESERVE',
      'PRE-TANTALIS RESERVE/NOTATION',
      'PROHIBITED USE AREA',
      'TEMPORARY CODE'
    ],
    'REVENUE SHARING AGREEMENT': [
      'REVENUE SHARING AGREEMENT'
    ],
    'RIGHT-OF-WAY': [
      'INTERIM LICENCE',
      'STATUTORY RIGHT OF WAY OR EASEMENT',
      'PRE-TANTALIS RIGHT-OF-WAY'
    ],
    'TRANSFER OF ADMINISTRATION/CONTROL': [
      'FED TRANSFER OF ADMIN, CONTROL & BEN',
      'PRE-TANTALIS TRANSFER OF ADMIN/CONT',
      'PROVINCIAL TRANSFER OF ADMIN'
    ]
  };

  public static readonly statuses = [
    'ACCEPTED',
    'ACTIVE',
    'ALLOWED',
    'CANCELLED',
    'COMPLETED',
    'DISALLOWED',
    'DISPOSITION IN GOOD STANDING',
    'EXPIRED',
    'HISTORIC',
    'OFFER ACCEPTED',
    'OFFER RESCINDED',
    'OFFERED',
    'PENDING',
    'PRE-TANTALIS',
    'RECEIVED',
    'REVERTED',
    'SOLD',
    'SUSPENDED',
    'WITHDRAWN'
  ];

  public static readonly purposes = [
    'AGRICULTURE',
    'ALL SEASONS RESORT',
    'ALPINE SKIING',
    'AQUACULTURE',
    'COMMERCIAL',
    'COMMERCIAL RECREATION',
    'COMMUNICATION',
    'COMMUNITY',
    'ENERGY PRODUCTION',
    'ENVIRONMENT, CONSERVATION, & RECREATION',
    'FIRST NATIONS',
    'INDUSTRIAL',
    'INSTITUTIONAL',
    'MISCELLANEOUS LAND USES',
    'OCEAN ENERGY',
    'PRE-TANTALIS',
    'QUARRYING',
    'RESIDENTIAL',
    'SOLAR POWER',
    'TRANSPORTATION',
    'UTILITY',
    'WATERPOWER',
    'WINDPOWER'
  ];

  public static readonly subpurposes = {
    'AGRICULTURE': [
      'EXTENSIVE',
      'GRAZING',
      'INTENSIVE'
    ],
    'ALL SEASONS RESORT': [
      'MISCELLANEOUS'
    ],
    'ALPINE SKIING': [
      'COMMERCIAL RESIDENTIAL',
      'CONTROLLED RECREATION AREA',
      'DAY SKIER FACILITY',
      'GENERAL',
      'INDEPENDENT RECREATION FACILITY',
      'LIFTS',
      'MAINTENANCE FACILITY',
      'MISCELLANEOUS',
      'PARKING FACILITY',
      'RUNS/TRAILS',
      'SUPPORT UTILITY'
    ],
    'AQUACULTURE': [
      'CRUSTACEANS',
      'FIN FISH',
      'PLANTS',
      'SHELL FISH'
    ],
    'COMMERCIAL': [
      'BACK-COUNTRY RECREATION',
      'COMMERCIAL A',
      'COMMERCIAL B',
      'COMMERCIAL RECREATION DOCK',
      'COMMERCIAL WHARF',
      'FILM PRODUCTION',
      'GENERAL',
      'GOLF COURSE',
      'HUNTING/FISHING CAMP',
      'MARINA',
      'MECHANIZED SKI GUIDING',
      'MISCELLANEOUS',
      'PRIVATE YACHT CLUB',
      'RESORT HUNT/FISH CAMPS & WHARVES',
      'TRAPLINE CABIN'
    ],
    'COMMERCIAL RECREATION': [
      'CAT SKI',
      'COMMUNITY OUTDOOR RECREATION',
      'ECO TOURIST LODGE/RESORT',
      'FISH CAMPS',
      'GUIDED CAVING',
      'GUIDED FRESHWATER RECREATION',
      'GUIDED MOUNTAINEERING/ROCK CLIMBING',
      'GUIDED NATURE VIEWING',
      'GUIDED SALTWATER RECREATION',
      'HELI HIKING',
      'HELI SKI',
      'HUNT CAMPS',
      'MISCELLANEOUS',
      'MULTIPLE USE',
      'NORDIC SKI (X COUNTRY SKIING)',
      'PRIVATE CAMPS',
      'SNOWMOBILING',
      'SPECIAL ACTIVITIES',
      'TIDAL SPORTS FISHING CAMPS',
      'TRAIL RIDING'
    ],
    'COMMUNICATION': [
      'COMBINED USES',
      'COMMUNICATION SITES'
    ],
    'COMMUNITY': [
      'COMMUNITY FACILITY',
      'MISCELLANEOUS',
      'TRAIL MAINTENANCE'
    ],
    'ENERGY PRODUCTION': [
      'BATTERY SITE',
      'CAMPSITE',
      'COMPRESSOR SITE',
      'DEHYDRATOR SITE',
      'DRILLSITE/WELLSITE',
      'FLARESITE',
      'GAS PROCESSING PLANT',
      'GENERAL',
      'INLET SITE',
      'LAND FARMS',
      'MAJOR COMPRESSION FACILITY',
      'METER SITE',
      'NON-FIELD TANK FARMS',
      'REFINERY',
      'WATER ANALYZER'
    ],
    'ENVIRONMENT, CONSERVATION, & RECREATION': [
      'BOAT HAVEN',
      'BUFFER ZONE',
      'ECOLOGICAL RESERVE',
      'ENVIRONMENT PROTECTION/CONSERVATION',
      'FISH AND WILDLIFE MANAGEMENT',
      'FISHERY FACILITY',
      'FLOODING RESERVE',
      'FOREST MANAGEMENT RESEARCH',
      'GREENBELT',
      'HERITAGE/ARCHEOLOGICAL SITE',
      'PROTECTED AREA STRATEGY',
      'PUBLIC ACCESS/PUBLIC TRAILS',
      'SCIENCE MEASUREMENT/RESEARCH',
      'SNOW SURVEY',
      'UREP/RECREATION RESERVE',
      'WATERSHED RESERVE'
    ],
    'FIRST NATIONS': [
      'COMMUNITY FACILITY',
      'CULTURAL SIGNIFICANCE',
      'INDIAN CUT-OFF',
      'INTERIM MEASURES',
      'LAND CLAIM SETTLEMENT',
      'RESERVE EXPANSION',
      'ROADS',
      'SPECIFIC CLAIMS',
      'TRADITIONAL USE',
      'TREATY AREA'
    ],
    'INDUSTRIAL': [
      'GENERAL',
      'HEAVY INDUSTRIAL',
      'INDUSTRIAL CAMPS',
      'LIGHT INDUSTRIAL',
      'LOG HANDLING/STORAGE',
      'MINERAL PRODUCTION',
      'MISCELLANEOUS'
    ],
    'INSTITUTIONAL': [
      'CEMETERY',
      'CORRECTIONS FACILITY',
      'FIRE HALL',
      'HOSPITAL/HEALTH FACILITY',
      'INDOOR RECREATION FACILITY',
      'LOCAL/REGIONAL PARK',
      'MILITARY SITE',
      'MISCELLANEOUS',
      'POLICE FACILITY',
      'PUBLIC WORKS',
      'SCHOOL/OUTDOOR EDUCATION FACILITY',
      'WASTE DISPOSAL SITE'
    ],
    'MISCELLANEOUS LAND USES': [
      'LAND EXCHANGE',
      'LAND USE PLAN INTERIM AGREEMENT',
      'OTHER',
      'PLANNING/MARKETING/DEVELOP PROJECTS'
    ],
    'OCEAN ENERGY': [
      'GENERAL AREA',
      'INVESTIGATIVE AND MONITORING PHASE'
    ],
    'PRE-TANTALIS': [
      'PRE-TANTALIS'
    ],
    'QUARRYING': [
      'CONSTRUCTION STONE',
      'LIMESTONE AND DOLOMITE',
      'MISCELLANEOUS',
      'PEAT AND SOIL',
      'POZZOLAN, CLAY, DIATOMACEOUS EARTH',
      'PUBLIC SAFETY - FLOOD MITIGATION',
      'RIP RAP',
      'ROCK FOR CRUSHING',
      'SAND AND GRAVEL'
    ],
    'RESIDENTIAL': [
      'APPLICATION ONLY - PRIVATE MOORAGE',
      'FLOATING CABIN',
      'FLOATING COMMUNITY',
      'MISCELLANEOUS',
      'PRIVATE MOORAGE',
      'RECREATIONAL RESIDENTIAL',
      'REMOTE RESIDENTIAL',
      'RURAL RESIDENTIAL',
      'STRATA MOORAGE',
      'THERMAL LOOPS',
      'URBAN RESIDENTIAL'
    ],
    'SOLAR POWER': [
      'INVESTIGATIVE PHASE'
    ],
    'TRANSPORTATION': [
      'AIRPORT/AIRSTRIP',
      'BRIDGES',
      'FERRY TERMINAL',
      'NAVIGATION AID',
      'PUBLIC WHARF',
      'RAILWAY',
      'ROADWAY'
    ],
    'UTILITY': [
      'CATHODIC SITE/ANODE BEDS',
      'ELECTRIC POWER LINE',
      'GAS AND OIL PIPELINE',
      'MISCELLANEOUS',
      'SEWER/EFFLUENT LINE',
      'TELECOMMUNICATION LINE',
      'WATER LINE'
    ],
    'WATERPOWER': [
      'CAMP',
      'COMMUNICATION SITE',
      'GENERAL AREA',
      'INTAKE',
      'INVESTIGATIVE PHASE',
      'NON-COMMERCIAL',
      'PENSTOCK',
      'POWERHOUSE SITE',
      'QUARRY',
      'ROAD',
      'TRANSMISSION LINE'
    ],
    'WINDPOWER': [
      'COMMUNICATION SITE',
      'DEVELOPMENT PHASE',
      'GENERAL AREA',
      'INTENSIVE',
      'INVESTIGATIVE AND MONITORING PHASE',
      'INVESTIGATIVE PHASE',
      'OPERATING PHASE',
      'QUARRY',
      'ROAD',
      'TRANSMISSION LINE'
    ]
  };
}
