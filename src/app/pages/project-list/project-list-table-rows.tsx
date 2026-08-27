import { useNavigate } from 'react-router';
import { track } from 'app/analytics/analytics';
import type { TableRowProps } from 'app/components/table/table-object';

export function ProjectListTableRow({ rowData }: TableRowProps) {
  const navigate = useNavigate();

  function goToProject(project: any): void {
    track('Project Viewed', {
      project_id: project._id,
      project_name: project.name,
      source: 'list_view'
    });
    navigate(`/p/${project._id}/project-details`);
  }

  return (
    <tr
      tabIndex={0}
      className="clickable-row"
      onClick={() => goToProject(rowData)}
      onKeyUp={event => {
        if (event.key === 'Enter') goToProject(rowData);
      }}
    >
      <td data-label="Name" className="col-2">{rowData.name || '-'}</td>
      <td data-label="Proponent" className="col-2">{rowData.proponent?.name || '-'}</td>
      <td data-label="Type" className="col-2">{rowData.type || '-'}</td>
      <td data-label="Region" className="col-2">{rowData.region || '-'}</td>
      <td data-label="Phase" className="col-2">{rowData.currentPhaseName?.name || '-'}</td>
      <td data-label="Decision" className="col-2">{rowData.eacDecision?.name || '-'}</td>
    </tr>
  );
}
