import { ProjectDocumentTab } from './project-document-tab';

const PANEL_SIZES = {
  issuedDate: 8,
  milestone: 4,
  documentAuthorType: 4,
  type: 4,
  projectPhase: 4,
};

export function DocumentsTab() {
  return (
    <ProjectDocumentTab
      tableId="documentsTab"
      emptyMessage="No results found."
      showFeatured
      panelSizes={PANEL_SIZES}
      groupedFilters
      trackFilters
    />
  );
}
