import { assignFromObj } from 'app/shared/utils/model-utils';

export class Project {
  // the following are retrieved from the API
  _id!: string;
  CEAAInvolvement!: any;
  CELead!: string;
  CELeadEmail!: string;
  CELeadPhone!: string;
  centroid: number[] = [];
  description!: string;
  eacDecision!: any;
  location!: string;
  name!: string;
  projectLeadId!: string;
  projectLeadObj?: any;
  projectLead!: string;
  projectLeadEmail!: string;
  projectLeadPhone!: string;
  proponent!: any;
  region!: string;
  responsibleEPDId!: string;
  responsibleEPDObj?: any;
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
  currentPhaseName!: any;
  currentPeriod?: any;
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
  commentPeriodForBanner!: any;
  projectCAC!: boolean;
  projectCACPublished!: boolean;
  cacEmail!: any;
  appStatus?: string; // Application status for display
  cpStatus?: string; // Comment period status for display
  clFile?: string; // CL File number
  purpose?: string; // Project purpose
  subpurpose?: string; // Project sub-purpose
  tantalisID?: string; // Tantalis ID number
  client?: string; // Client/applicant name

  // Permissions
  read?: string[] = [];
  write?: string[] = [];
  delete?: string[] = [];

  isLoaded?: boolean = false;

  featuredDocuments?: Document[] = [];


  constructor(obj?: any) {
    assignFromObj(this, obj, [
      '_id', 'operational', 'nature', 'CEAAInvolvement', 'CELead', 'CELeadEmail', 'CELeadPhone',
      'description', 'eacDecision', 'location', 'name', 'projectLeadId', 'projectLeadObj',
      'projectLead', 'projectLeadEmail', 'projectLeadPhone', 'proponent', 'region',
      'responsibleEPDId', 'responsibleEPDObj', 'responsibleEPD', 'responsibleEPDEmail',
      'responsibleEPDPhone', 'type', 'legislation', 'addedBy', 'build', 'CEAALink', 'code',
      'commodity', 'currentPhaseName', 'phaseHistory', 'dateAdded', 'dateUpdated', 'decisionDate',
      'duration', 'eaoMember', 'epicProjectID', 'fedElecDist', 'isTermsAgreed', 'overallProgress',
      'primaryContact', 'proMember', 'provElecDist', 'sector', 'shortName', 'status', 'substitution',
      'updatedBy', 'commentPeriodForBanner', 'cacEmail', 'projectCAC', 'projectCACPublished',
      'read', 'write', 'delete',
    ]);

    this.featuredDocuments = obj?.featuredDocuments ?? [];

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
        
        let decimal = degrees + (minutes / 60) + (seconds / 3600);
        
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
