import { Constants } from 'app/utils/constants';
import { ProjectDocumentTab } from './project-document-tab';

const PANEL_SIZES = { issuedDate: 6, milestone: 6, type: 4, projectPhase: 4 };

export function ComplianceDocumentsTab() {
  return (
    <ProjectDocumentTab
      tableId="complianceDocuments"
      tabKey={Constants.optionalProjectDocTabs.COMPLIANCE}
      emptyMessage="There are no compliance and enforcement documents associated with this project."
      panelSizes={PANEL_SIZES}
    />
  );
}
