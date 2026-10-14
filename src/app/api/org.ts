import { listNative } from './api';
import { logger } from 'app/config/logging';
import type { Org } from 'app/models/organization';

const PROPONENT = 'Proponent/Certificate Holder';

/** DEMI caps an anonymous native page here, and the public app is always anonymous. */
const ORGS_PAGE_SIZE = 100;

/** Every proponent organization, from DEMI's native `/organizations`, paged until `x-total-count`. */
async function getProponents(): Promise<Org[]> {
  const read = (page: number) =>
    listNative<Org>('organizations', {
      page,
      pageSize: ORGS_PAGE_SIZE,
      count: true,
      sort: 'name',
      filters: { companyType: PROPONENT },
    });
  const first = await read(1);
  const rows = [...first.rows];
  const total = first.total ?? rows.length;
  // An empty page ends it early, so a count that drifts between reads cannot loop.
  for (let page = 2; rows.length < total; page++) {
    const next = await read(page);
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  if (rows.length < total) {
    logger.warn(
      `Proponents answered ${rows.length} of ${total} rows; the rest are not shown`,
      'api',
    );
  }
  return rows;
}

/** Proponent organizations, lazily fetched and cached by TanStack Query. */
export function proponentsQueryOptions() {
  return {
    queryKey: ['proponents'],
    queryFn: getProponents,
  };
}
