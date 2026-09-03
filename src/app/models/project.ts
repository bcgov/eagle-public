/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
export class Project {
  // the following are retrieved from the API
  _id!: string;
  CEAAInvolvement: any;
  CELead!: string;
  CELeadEmail!: string;
  CELeadPhone!: string;
  centroid: number[] = [];
  description!: string;
  eacDecision: any;
  applicableRegulation?: any;
  location!: string;
  name!: string;
  projectLeadId!: string;
  projectLead!: string;
  projectLeadEmail!: string;
  projectLeadPhone!: string;
  proponent: any;
  region!: string;
  responsibleEPDId!: string;
  responsibleEPD!: string;
  responsibleEPDEmail!: string;
  responsibleEPDPhone!: string;
  type!: string;
  legislation!: string;

  // Everything else
  addedBy!: string;
  build!: string;
  CEAALink!: string;
  code!: string;
  commodity!: string;
  currentPhaseName: any;
  phaseHistory!: any[];
  dateAdded!: string;
  dateCommentsClosed!: string;
  dateUpdated!: string;
  decisionDate!: string;
  duration!: string;
  // TODO: directoryStructure
  eaoMember!: string;
  epicProjectID?: number;
  fedElecDist!: string;
  // TODO: intake
  isTermsAgreed!: boolean;
  overallProgress!: number;
  primaryContact!: string;
  proMember!: string;
  provElecDist!: string;
  sector!: string;
  shortName!: string;
  status!: string;
  substitution!: boolean;
  updatedBy?: string;
  operational?: any;
  nature?: any;
  commentPeriodForBanner: any;
  projectCAC!: boolean;
  projectCACPublished!: boolean;
  cacEmail: any;

  // Permissions
  read?: string[] = [];
  write?: string[] = [];
  delete?: string[] = [];

  featuredDocuments?: Document[] = [];

  constructor(obj?: any) {
    Object.assign(this, obj);

    // centroid can arrive as DMS strings; keep it empty unless both coordinates parse
    this.centroid = [];
    if (obj && obj.centroid && obj.centroid.length === 2) {
      const lon = Project.parseCoordinate(obj.centroid[0]);
      const lat = Project.parseCoordinate(obj.centroid[1]);
      if (lon !== null && lat !== null) {
        this.centroid = [lon, lat];
      }
    }
  }

  /**
   * Parse a coordinate value - handles both decimal numbers and DMS strings
   * DMS format examples: "53°49'42.9\"N", "122°43'20.8\"W"
   */
  static parseCoordinate(value: any): number | null {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }

    if (typeof value === 'string') {
      // Try parsing DMS format first: 53°49'42.9"N or 122°43'20.8"W
      const dmsRegex = /^(\d+)°(\d+)'([\d.]+)"?([NSEW])?$/i;
      const match = value.match(dmsRegex);
      if (match) {
        const degrees = parseFloat(match[1]);
        const minutes = parseFloat(match[2]);
        const seconds = parseFloat(match[3]);
        const direction = match[4]?.toUpperCase();

        let decimal = degrees + minutes / 60 + seconds / 3600;

        // Make negative for West or South
        if (direction === 'W' || direction === 'S') {
          decimal = -decimal;
        }

        return decimal;
      }

      // Try parsing as a simple number (must be the entire string)
      const num = parseFloat(value);
      if (!isNaN(num) && String(num) === value.trim()) {
        return num;
      }

      // Also accept numbers with optional whitespace
      if (!isNaN(num) && /^-?\d+\.?\d*$/.test(value.trim())) {
        return num;
      }
    }

    return null;
  }
}
