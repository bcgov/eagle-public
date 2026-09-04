import { Link } from 'react-router';
import { useTable } from 'app/components/table/use-table';
import { Constants } from 'app/utils/constants';
import { createProjectTabModifiers } from 'app/utils/utils';
import { useProjectContext } from './project-context';
import './compliance-tab.css';

/**
 * How many compliance and enforcement documents of one type the project has. A one-row search,
 * because only the total is shown.
 */
function useComplianceCount(
  tableId: string,
  projId: string,
  lists: any[],
  typeName: string,
): { count: number; loading: boolean } {
  const typeIds = lists
    .filter((item) => item.type === 'doctype' && item.name === typeName)
    .map((item) => item._id)
    .join(',');

  const result = useTable(tableId, {
    dataset: 'Document',
    enabled: !!projId && !!typeIds,
    fields: [{ name: 'project', value: projId }],
    currentPage: 1,
    pageSize: 1,
    sortBy: '',
    queryModifiers: {
      ...createProjectTabModifiers(Constants.optionalProjectDocTabs.COMPLIANCE, lists),
      type: typeIds,
    },
  });

  return { count: result.totalListItems, loading: result.loading };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className="compliance-tab__stat">
      <p className="compliance-tab__stat-value">{value}</p>
      <p className="compliance-tab__stat-label">{label}</p>
    </li>
  );
}

/** What the project's compliance record holds, and the way into the documents themselves. */
export function ComplianceTab() {
  const { projId, lists } = useProjectContext();

  const inspections = useComplianceCount(
    'complianceInspections',
    projId,
    lists,
    'Inspection Record',
  );
  const orders = useComplianceCount('complianceOrders', projId, lists, 'Order');

  const loading = inspections.loading || orders.loading;

  return (
    <section className="compliance-tab">
      <h2 className="compliance-tab__title">Compliance</h2>
      <p className="compliance-tab__intro">
        Compliance and enforcement of the certificate conditions is administered separately from the
        assessment itself.
      </p>

      <ul className="compliance-tab__stats" aria-busy={loading || undefined}>
        <Stat
          value={loading ? '—' : inspections.count.toLocaleString('en-CA')}
          label="Inspection records published"
        />
        <Stat value={loading ? '—' : orders.count.toLocaleString('en-CA')} label="Orders issued" />
      </ul>

      <Link className="compliance-tab__link" to={`/p/${projId}/documents/compliance`}>
        <i className="material-icons" aria-hidden="true">
          folder_open
        </i>
        View compliance and enforcement documents
      </Link>
    </section>
  );
}
