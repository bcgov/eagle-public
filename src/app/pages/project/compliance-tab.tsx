import { Link } from 'react-router';
import { useProjectContext } from './project-context';

/** Placeholder: inspection and order counts land with the Compliance tab build. */
export function ComplianceTab() {
  const { projId } = useProjectContext();

  return (
    <section>
      <h2>Compliance</h2>
      <p>
        <Link to={`/p/${projId}/documents/compliance`}>Compliance and enforcement documents</Link>
      </p>
    </section>
  );
}
