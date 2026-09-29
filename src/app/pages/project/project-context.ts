import { useOutletContext } from 'react-router';
import type { Project } from 'app/models/project';

export interface ProjectContext {
  project: Project | null;
  projId: string;
  /** `/p/:projId`, or `/pn/:projId` on a project notification: where the tab links hang off. */
  basePath: string;
  /** Known from the route before the record loads, so tabs can skip project-only reads. */
  isNotification: boolean;
  /** `List` collection items, already fetched by the shell so tabs and rows do not refetch them. */
  lists: any[];
  /** True while the shell's project fetch is still in flight, so tabs can show their own spinner. */
  projectLoading: boolean;
}

/** The project the shell loaded, for its tab routes. */
export function useProjectContext(): ProjectContext {
  return useOutletContext<ProjectContext>();
}
