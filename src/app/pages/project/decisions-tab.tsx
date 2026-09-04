import { Link } from 'react-router';
import { useProjectContext } from './project-context';

/** Placeholder: the decision card and certificate document list land with the Decisions tab build. */
export function DecisionsTab() {
  const { projId, project } = useProjectContext();
  const decision = project?.eacDecision?.name;

  return (
    <section>
      <h2>Decisions</h2>
      {decision && <p>EA decision: {decision}</p>}
      <p>
        <Link to={`/p/${projId}/documents/certificates`}>Certificate documents</Link>
      </p>
    </section>
  );
}
