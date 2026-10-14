import { listAllNative } from './api';
import type { Org } from 'app/models/organization';

const PROPONENT = 'Proponent/Certificate Holder';

/** Proponent organizations, lazily fetched and cached by TanStack Query. */
export function proponentsQueryOptions() {
  return {
    queryKey: ['proponents'],
    queryFn: () =>
      listAllNative<Org>('organizations', { sort: 'name', filters: { companyType: PROPONENT } }),
  };
}
