import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project } from 'app/models/project';
import { getAllFull } from 'app/api/project';
import { listsQueryOptions } from 'app/config/config';
import { isProjectInBounds, mapBounds, sheetState } from 'app/state/map-ui';
import { useResponsive } from 'app/state/responsive';
import { useStore } from 'app/state/store';
import { useProjectFilters } from './filter-state';
import { filterProjects } from './project-filter';
import { ProjlistFilters } from './projlist-filters';
import { ProjlistList } from './projlist-list';
import './projects.css';

// maplibre-gl is ~1 MB; keep it and its wrapper out of the main bundle until this page renders.
const ProjlistMap = lazy(() => import('./projlist-map').then((m) => ({ default: m.ProjlistMap })));

/** eagle-api's region list names the Thompson polygon "Thompson-Nicola"; the shapefile does not. */
const POLYGON_NAME: Record<string, string> = { 'Thompson-Nicola': 'Thompson' };

export function Projects() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const bounds = useStore(mapBounds);
  const mobile = useResponsive().isMobile;
  const { filters, updateFilters } = useProjectFilters();

  const { data: lists = [] } = useQuery(listsQueryOptions());
  // Fetched once and served from the query cache on later visits.
  const { data, isPending, isError } = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getAllFull(1, 1000000),
  });
  // null until the projects are known, so the list can tell "loading" from "none found".
  const allApps = useMemo<Project[] | null>(() => data ?? (isError ? [] : null), [data, isError]);

  const regions = useMemo(() => lists.filter((item: any) => item.type === 'region'), [lists]);
  const phases = useMemo(() => lists.filter((item: any) => item.type === 'projectPhase'), [lists]);

  // Empty means every region polygon draws.
  const regionNames = useMemo(
    () =>
      filters.regions
        .map((id) => regions.find((item: any) => item._id === id)?.name)
        .filter((name: string | undefined): name is string => !!name)
        .map((name: string) => POLYGON_NAME[name] ?? name),
    [filters.regions, regions],
  );

  const filterApps = useMemo(
    () => (allApps === null ? null : filterProjects(allApps, filters, regions)),
    [allApps, filters, regions],
  );
  const mapApps = useMemo(() => filterApps ?? [], [filterApps]);
  const listApps = useMemo(() => {
    if (filterApps === null) return null;
    if (!bounds) return filterApps;
    return filterApps.filter((project) => isProjectInBounds(project, bounds));
  }, [filterApps, bounds]);

  return (
    <div className="projects-view" data-mobile={mobile || undefined}>
      <h1 className="visually-hidden">
        Find Environmental Assessment Projects in British Columbia
      </h1>

      <aside className="projects-panel" id="applist-panel">
        <ProjlistFilters
          filters={filters}
          updateFilters={updateFilters}
          regions={regions}
          phases={phases}
        />

        <ProjlistList
          projects={listApps}
          loading={isPending}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={(project) =>
            setSelectedId((current) => (current === project._id ? null : project._id))
          }
          onHover={setHoveredId}
          mobile={mobile}
        />
      </aside>

      <div className="projects-map">
        <Suspense
          fallback={
            <div className="app-map is-loading">
              <div className="app-map__shimmer placeholder-wave" aria-hidden="true" />
            </div>
          }
        >
          <ProjlistMap
            projects={mapApps}
            loading={isPending}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={(project) => {
              setSelectedId(project?._id ?? null);
              // The card expands inside the list, so the sheet opens fully to show it.
              if (mobile && project) sheetState.set('full');
            }}
            onHover={setHoveredId}
            regionNames={regionNames}
            mobile={mobile}
          />
        </Suspense>
      </div>
    </div>
  );
}
