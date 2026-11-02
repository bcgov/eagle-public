import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { longDateBc } from 'app/utils/utils';
import { at } from './use-timeline-model';

/** An EA decision's date and certificate number, either half omitted when absent; `undefined`
 * when both are. */
export function eaDecisionDetail(
  decisionDate: string | undefined,
  eaCertificate: string | undefined,
  projId: string,
): ReactNode {
  // Eagle stores a blank decision date as the epoch.
  const date = at(decisionDate) !== null ? longDateBc(decisionDate) : undefined;
  const certificate = eaCertificate && <Link to={`/p/${projId}/decisions`}>{eaCertificate}</Link>;
  if (date && certificate)
    return (
      <>
        {date} · {certificate}
      </>
    );
  return date ?? certificate ?? undefined;
}
