import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project } from 'app/models/project';
import { getAllFull } from 'app/api/project';
import { listsQueryOptions } from 'app/config/config';
import { track } from 'app/analytics/analytics';
import { applistVisible, isProjectInBounds, mapBounds } from 'app/state/map-ui';
import { useStore } from 'app/state/store';
import { useProjectFilters } from './filter-state';
import { filterProjects } from './project-filter';
import { ProjlistFilters } from './projlist-filters';
import { ProjlistList } from './projlist-list';
import { ProjlistMap } from './projlist-map';
import './projects.css';

export function Projects() {
  const filtersRef = useRef<HTMLDivElement>(null);
  const [showSearchMobile, setShowSearchMobile] = useState(false);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);

  const listVisible = useStore(applistVisible);
  const bounds = useStore(mapBounds);
  const { filters, updateFilters } = useProjectFilters();

  const { data: lists = [] } = useQuery(listsQueryOptions());
  // Fetched once and served from the query cache on later visits.
  const { data, isPending, isError } = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getAllFull(1, 1000000)
  });
  // null until the projects are known, so the list can tell "loading" from "none found".
  const allApps = useMemo<Project[] | null>(() => data ?? (isError ? [] : null), [data, isError]);

  const regions = useMemo(() => lists.filter((item: any) => item.type === 'region'), [lists]);
  const phases = useMemo(() => lists.filter((item: any) => item.type === 'projectPhase'), [lists]);

  const filterApps = useMemo(
    () => (allApps === null ? null : filterProjects(allApps, filters, regions)),
    [allApps, filters, regions]
  );
  const mapApps = useMemo(() => filterApps ?? [], [filterApps]);
  const listApps = useMemo(() => {
    if (filterApps === null) return null;
    if (!bounds) return filterApps;
    return filterApps.filter(project => isProjectInBounds(project, bounds));
  }, [filterApps, bounds]);

  // The list and filter panels sit on top of the map, so their clicks and scrolls must not reach it.
  useEffect(() => {
    for (const id of ['applist-list', 'applist-filters']) {
      const element = document.getElementById(id);
      if (element) {
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
      }
    }
  }, []);

  function toggleAppList(): void {
    const next = !applistVisible.get();
    applistVisible.set(next);
    track('Projects View Changed', {
      view: next ? 'list' : 'map',
      total_projects: allApps?.length ?? 0,
      filtered_projects: filterApps?.length ?? 0,
      list_projects: listApps?.length ?? 0
    });
  }

  function toggleCurrentApp(project: Project): void {
    setCurrentAppId(current => (current === project._id ? null : project._id));
  }

  return (
    <div className={`projects-view ${listVisible ? 'app-list-open' : 'app-list-closed'}`}>
      <h1 className="visually-hidden">Find Environmental Assessment Projects in British Columbia</h1>

      <ProjlistFilters
        ref={filtersRef}
        filters={filters}
        updateFilters={updateFilters}
        regions={regions}
        phases={phases}
        showSearchMobile={showSearchMobile}
        onToggleSearchMobile={() => setShowSearchMobile(open => !open)}
      />

      <div className="app-list-map-container">
        <div className="app-list-container">
          <ProjlistList
            projects={listApps}
            loading={isPending}
            currentAppId={currentAppId}
            onToggleCurrentApp={toggleCurrentApp}
          />
        </div>

        <div
          className="overlay"
          role="button"
          tabIndex={0}
          aria-label="Close project list"
          onClick={event => {
            toggleAppList();
            event.stopPropagation();
          }}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggleAppList();
            event.stopPropagation();
          }}
        />

        <ProjlistMap
          projects={mapApps}
          loading={isPending}
          filtersRef={filtersRef}
          hasActiveSearch={!!filters.applicant}
          showSearchMobile={showSearchMobile}
          onCloseSearchMobile={() => setShowSearchMobile(false)}
          onToggleCurrentApp={toggleCurrentApp}
        />
      </div>
    </div>
  );
}
