import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { longDate } from 'app/utils/utils';

/** An EA decision's date and certificate number, either half omitted when absent; `undefined`
 * when both are. Pass `longDateUtc` as `format` for a Track date. */
export function eaDecisionDetail(
  decisionDate: string | undefined,
  eaCertificate: string | undefined,
  projId: string,
  format: (value: string) => string = longDate,
): ReactNode {
  const date = decisionDate ? format(decisionDate) : undefined;
  const certificate = eaCertificate && <Link to={`/p/${projId}/decisions`}>{eaCertificate}</Link>;
  if (date && certificate)
    return (
      <>
        {date} · {certificate}
      </>
    );
  return date ?? certificate ?? undefined;
}
