import * as api from './api';

/** Proponent organizations, lazily fetched and cached by TanStack Query. */
export function proponentsQueryOptions() {
  return {
    queryKey: ['proponents'],
    queryFn: () => api.getOrgsByCompanyType('Proponent/Certificate Holder'),
  };
}
