import { Constants } from 'app/utils/constants';
import { ProjectDocumentTab } from './project-document-tab';

const PANEL_SIZES = { issuedDate: 6, milestone: 6, type: 6, projectPhase: 6 };

export function Application() {
  return (
    <ProjectDocumentTab
      tableId="application"
      tabKey={Constants.optionalProjectDocTabs.APPLICATION}
      emptyMessage="There are no application documents associated with this project."
      panelSizes={PANEL_SIZES}
      groupedFilters
    />
  );
}
