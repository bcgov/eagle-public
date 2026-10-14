/** An `Organization` row as DEMI's native `/organizations` answers it. `id` is the Eagle id. */
export interface Org {
  id: string;
  name: string;
  companyType?: string;
  province?: string;
  country?: string;
  city?: string;
  address1?: string;
  postal?: string;
  website?: string;
}
