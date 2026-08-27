import { useOutletContext } from 'react-router';
import type { Project } from 'app/models/project';

export interface ProjectContext {
  project: Project | null;
  projId: string;
  /** `List` collection items, already fetched by the shell so tabs and rows do not refetch them. */
  lists: any[];
  /** True while the shell's project fetch is still in flight, so tabs can show their own spinner. */
  projectLoading: boolean;
}

/** The project the shell loaded, for its tab routes. */
export function useProjectContext(): ProjectContext {
  return useOutletContext<ProjectContext>();
}
