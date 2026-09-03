/** Fields are copied straight off the API payload, so a missing one is `undefined`. */
export class Org {
  _id!: string;
  description!: string;
  name!: string;
  code!: string;
  updatedBy!: string;
  dateAdded!: string;
  country!: string;
  postal!: string;
  province!: string;
  city!: string;
  address1!: string;
  address2!: string;
  companyType!: string;
  parentCompany!: string;
  registeredIn!: string;
  companyLegal!: string;
  website!: string;
  company!: string;

  constructor(obj?: any) {
    Object.assign(this, obj);
  }
}
