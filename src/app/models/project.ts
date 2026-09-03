export class Project {
  // the following are retrieved from the API
  _id: string;
  CEAAInvolvement: any;
  CELead: string;
  CELeadEmail: string;
  CELeadPhone: string;
  centroid: number[] = [];
  description: string;
  eacDecision: any;
  applicableRegulation?: any;
  location: string;
  name: string;
  projectLeadId: string;
  projectLead: string;
  projectLeadEmail: string;
  projectLeadPhone: string;
  proponent: any;
  region: string;
  responsibleEPDId: string;
  responsibleEPD: string;
  responsibleEPDEmail: string;
  responsibleEPDPhone: string;
  type: string;
  legislation: string;

  // Everything else
  addedBy: string;
  build: string;
  CEAALink: string;
  code: string;
  commodity: string;
  currentPhaseName: any;
  phaseHistory: any[];
  dateAdded: string;
  dateCommentsClosed!: string;
  dateUpdated: string;
  decisionDate: string;
  duration: string;
  // TODO: directoryStructure
  eaoMember: string;
  epicProjectID?: number;
  fedElecDist: string;
  // TODO: intake
  isTermsAgreed: boolean;
  overallProgress: number;
  primaryContact: string;
  proMember: string;
  provElecDist: string;
  sector: string;
  shortName: string;
  status: string;
  substitution: boolean;
  updatedBy?: string;
  operational?: any;
  nature?: any;
  commentPeriodForBanner: any;
  projectCAC: boolean;
  projectCACPublished: boolean;
  cacEmail: any;

  // Permissions
  read?: string[] = [];
  write?: string[] = [];
  delete?: string[] = [];

  featuredDocuments?: Document[] = [];

  constructor(obj?: any) {
    this._id = (obj && obj._id) || null;
    this.operational = (obj && obj.operational) || null;
    this.nature = (obj && obj.nature) || null;
    this.CEAAInvolvement = (obj && obj.CEAAInvolvement) || null;
    this.CELead = (obj && obj.CELead) || null;
    this.CELeadEmail = (obj && obj.CELeadEmail) || null;
    this.CELeadPhone = (obj && obj.CELeadPhone) || null;
    this.description = (obj && obj.description) || null;
    this.eacDecision = (obj && obj.eacDecision) || null;
    this.applicableRegulation = (obj && obj.applicableRegulation) || null;
    this.location = (obj && obj.location) || null;
    this.name = (obj && obj.name) || null;
    this.projectLeadId = (obj && obj.projectLeadId) || null;
    this.projectLead = (obj && obj.projectLead) || null;
    this.projectLeadEmail = (obj && obj.projectLeadEmail) || null;
    this.projectLeadPhone = (obj && obj.projectLeadPhone) || null;
    this.proponent = (obj && obj.proponent) || null;
    this.region = (obj && obj.region) || null;
    this.responsibleEPDId = (obj && obj.responsibleEPDId) || null;
    this.responsibleEPD = (obj && obj.responsibleEPD) || null;
    this.responsibleEPDEmail = (obj && obj.responsibleEPDEmail) || null;
    this.responsibleEPDPhone = (obj && obj.responsibleEPDPhone) || null;
    this.type = (obj && obj.type) || null;
    this.legislation = (obj && obj.legislation) || null;
    this.addedBy = (obj && obj.addedBy) || null;
    this.build = (obj && obj.build) || null;
    this.CEAALink = (obj && obj.CEAALink) || null;
    this.code = (obj && obj.code) || null;
    this.commodity = (obj && obj.commodity) || null;
    this.currentPhaseName = (obj && obj.currentPhaseName) || null;
    this.phaseHistory = (obj && obj.phaseHistory) || null;
    this.dateAdded = (obj && obj.dateAdded) || null;
    this.dateUpdated = (obj && obj.dateUpdated) || null;
    this.decisionDate = (obj && obj.decisionDate) || null;
    this.duration = (obj && obj.duration) || null;
    this.eaoMember = (obj && obj.eaoMember) || null;
    this.epicProjectID = (obj && obj.epicProjectID) || null;
    this.fedElecDist = (obj && obj.fedElecDist) || null;
    this.isTermsAgreed = (obj && obj.isTermsAgreed) || null;
    this.overallProgress = (obj && obj.overallProgress) || null;
    this.primaryContact = (obj && obj.primaryContact) || null;
    this.proMember = (obj && obj.proMember) || null;
    this.provElecDist = (obj && obj.provElecDist) || null;
    this.sector = (obj && obj.sector) || null;
    this.shortName = (obj && obj.shortName) || null;
    this.status = (obj && obj.status) || null;
    this.substitution = (obj && obj.substitution) || null;
    this.updatedBy = (obj && obj.updatedBy) || null;
    this.commentPeriodForBanner = (obj && obj.commentPeriodForBanner) || null;
    this.cacEmail = (obj && obj.cacEmail) || null;
    this.projectCAC = (obj && obj.projectCAC) || null;
    this.projectCACPublished = (obj && obj.projectCACPublished) || null;
    this.read = (obj && obj.read) || null;
    this.write = (obj && obj.write) || null;
    this.delete = (obj && obj.delete) || null;

    this.featuredDocuments = (obj && obj.featuredDocuments) || [];

    // copy centroid - convert DMS strings to decimal if needed
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
