import { useQuery } from '@tanstack/react-query';
import { getPins } from 'app/api/project';
import { useProjectContext } from './project-context';

/** No project publishes anywhere near this many Nations, so the card never pages. */
const PAGE_SIZE = 100;

/** Participating Indigenous Nations for the project. The card is absent when there are none. */
export function Pins() {
  const { projId } = useProjectContext();

  const { data: nations, isPending } = useQuery({
    queryKey: ['pins', projId],
    enabled: !!projId,
    queryFn: async () => {
      const response = await getPins(projId, 1, PAGE_SIZE, '+name');
      return response?.[0]?.results ?? [];
    },
  });

  if (!isPending && (!nations || nations.length === 0)) {
    return null;
  }

  return (
    <section aria-labelledby="pins-title">
      <h2 id="pins-title">Participating Indigenous Nations</h2>
      <p className="overview-tab__description overview-tab__description--tight">
        Nations participating in the assessment of this project.
      </p>
      {isPending && (
        <p className="overview-tab__empty" aria-busy="true">
          Loading
        </p>
      )}
      <ul className="overview-tab__list">
        {(nations ?? []).map((nation: any) => (
          <li className="overview-tab__row" key={nation._id || nation.name}>
            <span className="overview-tab__list-title">{nation.name}</span>
            <span className="overview-tab__row-meta">{nation.province}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
