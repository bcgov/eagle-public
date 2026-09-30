import { useRef } from 'react';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { TypesChart } from './types-chart';
import { useProjectTypeTree } from './use-project-type-tree';
import { useNearViewport } from './use-near-viewport';
import './projects-by-type.css';

const SKELETON_ROWS = [1, 2, 3, 4, 5];

function TypesBody({ enabled }: { enabled: boolean }) {
  const { tree, total, failed, truncated } = useProjectTypeTree(enabled);

  if (failed) {
    return (
      <p className="home-note">
        <span className="home-note__title">Project types are unavailable right now.</span>
        <span className="home-note__detail">Try again in a moment.</span>
      </p>
    );
  }
  if (tree === null) {
    return (
      <div className="home-types__loading" aria-busy="true">
        <span className="visually-hidden">Loading</span>
        <Skeleton height="380px" />
        {SKELETON_ROWS.map((index) => (
          <Skeleton key={index} width={`${90 - index * 12}%`} />
        ))}
      </div>
    );
  }
  return (
    <>
      {truncated && (
        <p className="home-types__note">
          Showing the first {truncated.shown} of {truncated.of} projects.
        </p>
      )}
      <TypesChart tree={tree} total={total} />
    </>
  );
}

/** Every project by type, then sub-type, then the projects themselves. */
export function ProjectsByType() {
  const sectionRef = useRef<HTMLElement>(null);
  // The band sits below the fold and reads every project, so it waits until the visitor nears it.
  const near = useNearViewport(sectionRef, '200px');
  return (
    <section ref={sectionRef} className="home-types" aria-labelledby="home-types-heading">
      <div className="page-container home-types__inner">
        <h2 id="home-types-heading" className="home-band__heading">
          Projects by type
        </h2>
        <p className="home-band__body">
          Environmental assessments cover mines, energy, transportation, waste and more. Select a
          type to see its sub-types, then open any sub-type to find its projects.
        </p>
        <TypesBody enabled={near} />
      </div>
    </section>
  );
}
