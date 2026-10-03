import { Constants } from 'app/utils/constants';
import { ProjectDocumentTab } from './project-document-tab';

// No type filter: the tab already fixes the document type.
const PANEL_SIZES = { issuedDate: 6, milestone: 6, projectPhase: 6 };

export function ManagementPlans() {
  return (
    <ProjectDocumentTab
      tableId="managementPlans"
      tabKey={Constants.optionalProjectDocTabs.MANAGEMENT_PLAN}
      emptyMessage="There are no management plan documents associated with this project."
      panelSizes={PANEL_SIZES}
    />
  );
}
