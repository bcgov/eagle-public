export class Project {
  // the following are retrieved from the API
  _id: string;
  CEAAInvolvement: String;
  CELead: String;
  CELeadEmail: String;
  CELeadPhone: String;
  centroid: Array<number> = [];
  description: String;
  eacDecision: String;
  location: String;
  name: String;
  projectLeadId: String;
  projectLeadObj: any;
  projectLead: String;
  projectLeadEmail: String;
  projectLeadPhone: String;
  proponent: any;
  region: String;
  responsibleEPDId: String;
  responsibleEPDObj: any;
  responsibleEPD: String;
  responsibleEPDEmail: String;
  responsibleEPDPhone: String;
  type: String;
  legislation: String;

  // Everything else
  addedBy: String;
  build: String;
  CEAALink: String;
  code: String;
  commodity: String;
  currentPhaseName: string;
  dateAdded: String;
  dateUpdated: String;
  decisionDate: String;
  duration: String;
  // TODO: directoryStructure
  eaoMember: String;
  epicProjectID: Number;
  fedElecDist: String;
  // TODO: intake
  isTermsAgreed: Boolean;
  overallProgress: Number;
  primaryContact: String;
  proMember: String;
  provElecDist: String;
  sector: String;
  shortName: String;
  status: String;
  substitution: Boolean;
  updatedBy: String;
  operational: any;
  nature: any;
  commentPeriodForBanner: any;

  // Permissions
  read: Array<String> = [];
  write: Array<String> = [];
  delete: Array<String> = [];

  isMatches = true;
  isVisible = true;
  isLoaded = false;



  constructor(obj?: any) {
    this._id                 = obj && obj._id                 || null;
    this.operational     = obj && obj.operational     || null;
    this.nature     = obj && obj.nature     || null;
    this.CEAAInvolvement     = obj && obj.CEAAInvolvement     || null;
    this.CELead              = obj && obj.CELead              || null;
    this.CELeadEmail         = obj && obj.CELeadEmail         || null;
    this.CELeadPhone         = obj && obj.CELeadPhone         || null;
    this.description         = obj && obj.description         || null;
    this.eacDecision         = obj && obj.eacDecision         || null;
    this.location            = obj && obj.location            || null;
    this.name                = obj && obj.name                || null;
    this.projectLeadId         = obj && obj.projectLeadId         || null;
    this.projectLeadObj         = obj && obj.projectLeadObj         || null;
    this.projectLead         = obj && obj.projectLead         || null;
    this.projectLeadEmail    = obj && obj.projectLeadEmail    || null;
    this.projectLeadPhone    = obj && obj.projectLeadPhone    || null;
    this.proponent           = obj && obj.proponent           || null;
    this.region              = obj && obj.region              || null;
    this.responsibleEPDId      = obj && obj.responsibleEPDId      || null;
    this.responsibleEPDObj      = obj && obj.responsibleEPDObj      || null;
    this.responsibleEPD      = obj && obj.responsibleEPD      || null;
    this.responsibleEPDEmail = obj && obj.responsibleEPDEmail || null;
    this.responsibleEPDPhone = obj && obj.responsibleEPDPhone || null;
    this.type                = obj && obj.type                || null;
    this.legislation         = obj && obj.legislation         || null;
    this.addedBy             = obj && obj.addedBy             || null;
    this.build               = obj && obj.build               || null;
    this.CEAALink            = obj && obj.CEAALink            || null;
    this.code                = obj && obj.code                || null;
    this.commodity           = obj && obj.commodity           || null;
    this.currentPhaseName    = obj && obj.currentPhaseName    || null;
    this.dateAdded           = obj && obj.dateAdded           || null;
    this.dateUpdated         = obj && obj.dateUpdated         || null;
    this.decisionDate        = obj && obj.decisionDate        || null;
    this.duration            = obj && obj.duration            || null;
    this.eaoMember           = obj && obj.eaoMember           || null;
    this.epicProjectID       = obj && obj.epicProjectID       || null;
    this.fedElecDist         = obj && obj.fedElecDist         || null;
    this.isTermsAgreed       = obj && obj.isTermsAgreed       || null;
    this.overallProgress     = obj && obj.overallProgress     || null;
    this.primaryContact      = obj && obj.primaryContact      || null;
    this.proMember           = obj && obj.proMember           || null;
    this.provElecDist        = obj && obj.provElecDist        || null;
    this.sector              = obj && obj.sector              || null;
    this.shortName           = obj && obj.shortName           || null;
    this.status              = obj && obj.status              || null;
    this.substitution        = obj && obj.substitution        || null;
    this.updatedBy           = obj && obj.updatedBy           || null;
    this.commentPeriodForBanner           = obj && obj.commentPeriodForBanner           || null;
    this.read                = obj && obj.read                || null;
    this.write               = obj && obj.write               || null;
    this.delete              = obj && obj.delete              || null;

    // if (obj && obj.publishDate) {
    //   this.publishDate = new Date(obj.publishDate);
    // }

    // // replace \\n (JSON format) with newlines
    // if (obj && obj.description) {
    //   this.description = obj.description.replace(/\\n/g, '\n');
    // }
    // if (obj && obj.legalDescription) {
    //   this.legalDescription = obj.legalDescription.replace(/\\n/g, '\n');
    // }

    // copy centroid
    if (obj && obj.centroid) {
      obj.centroid.forEach(num => {
        this.centroid.push(num);
      });
    }

    // if (obj && obj.decision) {
    //   this.decision = new Decision(obj.decision);
    // }

    // // copy documents
    // if (obj && obj.documents) {
    //   for (const doc of obj.documents) {
    //     this.documents.push(doc);
    //   }
    // }

    // // copy features
    // if (obj && obj.features) {
    //   for (const feature of obj.features) {
    //     this.features.push(feature);
    //   }
    // }
  }
}
