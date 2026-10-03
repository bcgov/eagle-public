import { Constants } from 'app/utils/constants';
import { ProjectDocumentTab } from './project-document-tab';

const PANEL_SIZES = { issuedDate: 6, milestone: 6, type: 4, projectPhase: 4 };

export function Amendments() {
  return (
    <ProjectDocumentTab
      tableId="amendments"
      tabKey={Constants.optionalProjectDocTabs.AMENDMENT}
      emptyMessage="There are no amendment documents associated with this project."
      panelSizes={PANEL_SIZES}
    />
  );
}
