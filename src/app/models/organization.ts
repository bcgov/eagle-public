import { assignFromObj } from 'app/shared/utils/model-utils';

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
    assignFromObj(this, obj, [
      '_id', 'description', 'name', 'code', 'updatedBy', 'dateAdded', 'country', 'postal',
      'province', 'city', 'address1', 'address2', 'companyType', 'parentCompany',
      'registeredIn', 'companyLegal', 'website', 'company',
    ], undefined);
  }
}
