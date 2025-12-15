export class Client {
  CITY: string;
  COUNTRY: string;
  DISPOSITION_TRANSACTION_SID: number;
  INDIVIDUALS_FIRST_NAME: string;
  INDIVIDUALS_LAST_NAME: string;
  INTERESTED_PARTY_SID: number;
  ORGANIZATIONS_LEGAL_NAME: string;
  PROVINCE_ABBREVIATION: string;
  STATE_ABBREVIATION: string;

  constructor(obj?: any) {
    this.CITY                        = obj && obj.CITY                        || null;
    this.COUNTRY                     = obj && obj.COUNTRY                     || null;
    this.DISPOSITION_TRANSACTION_SID = obj && obj.DISPOSITION_TRANSACTION_SID || null;
    this.INDIVIDUALS_FIRST_NAME      = obj && obj.INDIVIDUALS_FIRST_NAME      || null;
    this.INDIVIDUALS_LAST_NAME       = obj && obj.INDIVIDUALS_LAST_NAME       || null;
    this.INTERESTED_PARTY_SID        = obj && obj.INTERESTED_PARTY_SID        || null;
    this.ORGANIZATIONS_LEGAL_NAME    = obj && obj.ORGANIZATIONS_LEGAL_NAME    || null;
    this.PROVINCE_ABBREVIATION       = obj && obj.PROVINCE_ABBREVIATION       || null;
    this.STATE_ABBREVIATION          = obj && obj.STATE_ABBREVIATION          || null;
  }
}
