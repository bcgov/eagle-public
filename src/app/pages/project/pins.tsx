import { useQuery } from '@tanstack/react-query';
import { projectPinsQueryOptions } from 'app/api/project';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { useProjectContext } from './project-context';

/** Rows a list holds open while its first page is in flight. */
const SKELETON_ROWS = [1, 2, 3];

/** Participating Indigenous Nations for the project. The card is absent when there are none. */
export function Pins() {
  const { projId } = useProjectContext();

  const { data: nations, isPending } = useQuery(projectPinsQueryOptions(projId));

  if (!isPending && (!nations || nations.length === 0)) {
    return null;
  }

  return (
    <section aria-labelledby="pins-title">
      <h2 id="pins-title">Participating Indigenous Nations</h2>
      <p className="details-panel__description overview-tab__description--tight">
        Nations participating in the assessment of this project.
      </p>
      {isPending ? (
        <ul className="overview-tab__list" aria-busy="true">
          <li className="visually-hidden">Loading participating Indigenous Nations</li>
          {SKELETON_ROWS.map((row) => (
            <li className="overview-tab__row" key={row}>
              <Skeleton width="55%" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="overview-tab__list">
          {(nations ?? []).map((nation) => (
            <li className="overview-tab__row" key={nation._id || nation.name}>
              <span className="overview-tab__list-title">{nation.name}</span>
              <span className="overview-tab__row-meta">{nation.province}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
