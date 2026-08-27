import { Constants } from 'app/utils/constants';
import { ProjectDocumentTab } from './project-document-tab';

export function Certificates() {
  return (
    <ProjectDocumentTab
      tableId="certificates"
      tabKey={Constants.optionalProjectDocTabs.CERTIFICATE}
      emptyMessage="There are no certificate documents associated with this project."
    />
  );
}
