import { Link } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { useTable } from 'app/components/table/use-table';
import { useDemiProject } from 'app/api/project-phases';
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

function Stat({ value, label, loading }: { value: string; label: string; loading: boolean }) {
  return (
    <li className="compliance-tab__stat">
      <p className="compliance-tab__stat-value">{loading ? <Skeleton width="3rem" /> : value}</p>
      <p className="compliance-tab__stat-label">{label}</p>
    </li>
  );
}

/** What the project's compliance record holds, and the way into the documents themselves. */
export function ComplianceTab() {
  const { projId, lists } = useProjectContext();
  const eaCertificate = useDemiProject(projId).data?.eaCertificate?.trim();

  const inspections = useComplianceCount(
    'complianceInspections',
    projId,
    lists,
    'Inspection Record',
  );
  const orders = useComplianceCount('complianceOrders', projId, lists, 'Order');

  // Both counts key off document type ids from the lists, so an unstarted query still counts as
  // loading rather than a zero.
  const loading = inspections.loading || orders.loading || lists.length === 0;

  return (
    <section className="compliance-tab">
      <h2 className="compliance-tab__title">Conditions &amp; compliance</h2>
      <p className="compliance-tab__intro">
        {`${eaCertificate ? `Certificate ${eaCertificate} carries` : 'The certificate carries'} ` +
          'legally binding conditions. Compliance and enforcement of these conditions is ' +
          'administered separately from the assessment itself.'}
      </p>

      <ul className="compliance-tab__stats" aria-busy={loading || undefined}>
        {loading && <li className="visually-hidden">Loading compliance record</li>}
        <Stat
          value={inspections.count.toLocaleString('en-CA')}
          label="Inspection records published"
          loading={loading}
        />
        <Stat
          value={orders.count.toLocaleString('en-CA')}
          label="Orders issued"
          loading={loading}
        />
      </ul>

      <Link className="compliance-tab__link" to={`/p/${projId}/documents/compliance`}>
        <i className="material-icons" aria-hidden="true">
          folder_open
        </i>
        View inspection records and orders
      </Link>
    </section>
  );
}
