import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import type { Project } from 'app/models/project';
import { allProjectsQueryOptions, searchProjectIds } from 'app/api/project';
import { listsQueryOptions } from 'app/api/api';
import {
  engagementPeriodsByProject,
  engagementStatesByProject,
  openCommentPeriodsQueryOptions,
  upcomingCommentPeriodsQueryOptions,
} from 'app/api/commentperiod';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import { logger } from 'app/config/logging';
import { isProjectInBounds, mapBounds, sheetState } from 'app/state/map-ui';
import { useResponsive } from 'app/state/responsive';
import { useStore } from 'app/state/store';
import { useSettled } from 'app/pages/search/use-settled';
import {
  filtersToParams,
  SORT_LABEL,
  trackFiltersApplied,
  useProjectFilters,
  type ProjectSort,
} from './filter-state';
import { SELECTED_PARAM } from './explorer-link';
import { filterProjects, projectMatchesFilters, sortProjects } from './project-filter';
import { ProjlistFilters, ProjlistSort } from './projlist-filters';
import { ProjlistList } from './projlist-list';
import './projects.css';

// maplibre-gl is ~1 MB; keep it and its wrapper out of the main bundle until this page renders.
const ProjlistMap = lazy(() => import('./projlist-map').then((m) => ({ default: m.ProjlistMap })));

/** eagle-api's region list names the Thompson polygon "Thompson-Nicola"; the shapefile does not. */
const POLYGON_NAME: Record<string, string> = { 'Thompson-Nicola': 'Thompson' };

export function Projects() {
  const [params, setParams] = useSearchParams();
  // Seeded once from a project page's link; later filter changes may drop it from the URL.
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get(SELECTED_PARAM));
  // Once the visitor clears the selection, the link's id leaves the URL, so a reload keeps it clear.
  useEffect(() => {
    if (selectedId !== null || !params.has(SELECTED_PARAM)) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(SELECTED_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [selectedId, params, setParams]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** Read out with the result count after a sort change; the list reorders without a sound. */
  const [sortNote, setSortNote] = useState('');

  const bounds = useStore(mapBounds);
  const mobile = useResponsive().isMobile;
  const { filters, updateFilters } = useProjectFilters();

  const { data: lists = [] } = useQuery(listsQueryOptions());
  // Fetched once and served from the query cache on later visits. A keyword search only ranks
  // ids against this list, so every card and popup keeps the full list's fields.
  const { data, isError } = useQuery(allProjectsQueryOptions());
  // null until the projects are known, so the list can tell "loading" from "none found".
  const allApps = useMemo<Project[] | null>(() => data ?? (isError ? [] : null), [data, isError]);
  const projectsById = useMemo(
    () => new Map((allApps ?? []).map((project) => [project._id, project])),
    [allApps],
  );
  // A linked id the loaded list does not hold is dropped, so it never holds back the map's refit.
  if (allApps !== null && selectedId !== null && !projectsById.has(selectedId)) setSelectedId(null);

  // One character searches nothing, as in the other typeahead boxes.
  const typed = typeaheadKeywords(filters.applicant ?? '').toLowerCase();
  const settled = useSettled(typed, TYPEAHEAD_DEBOUNCE_MS);
  // The term settled when the box was emptied. It stays out until the box holds it again, so a
  // term typed straight after clearing never shows the old results while it settles.
  const [cleared, setCleared] = useState<string | null>(null);
  if (!typed && settled && cleared !== settled) setCleared(settled);
  if (typed && cleared !== null && settled !== cleared) setCleared(null);
  const keywords = typed && (settled !== cleared || settled === typed) ? settled : '';
  const search = useQuery<string[] | null>({
    queryKey: ['projects', 'search', keywords],
    queryFn: () => searchProjectIds(keywords),
    enabled: keywords !== '',
    // No keywords is data too (null, the full list), so it becomes the placeholder after a clear.
    initialData: keywords ? undefined : null,
    // The last answer stays on screen while the next search runs.
    placeholderData: keepPreviousData,
  });
  const searchFailed = keywords !== '' && search.isError;
  // In demi-search's order; an id missing from the full list drops out.
  const matchedApps = useMemo<Project[] | null>(() => {
    if (allApps === null) return null;
    if (search.data === undefined) return searchFailed ? [] : null;
    if (search.data === null) return allApps;
    return search.data
      .map((id) => projectsById.get(id))
      .filter((project): project is Project => !!project);
  }, [allApps, projectsById, search.data, searchFailed]);

  // Marker state and the card's engagement banner; the map draws without them and picks them up
  // when both reads settle.
  const openPeriods = useQuery(openCommentPeriodsQueryOptions());
  const upcomingPeriods = useQuery(upcomingCommentPeriodsQueryOptions());
  const periodsSettled = openPeriods.status !== 'pending' && upcomingPeriods.status !== 'pending';
  const engagementById = useMemo(
    () =>
      periodsSettled
        ? engagementPeriodsByProject(openPeriods.data?.periods ?? [], upcomingPeriods.data ?? [])
        : undefined,
    [periodsSettled, openPeriods.data, upcomingPeriods.data],
  );
  // Every state, not only the one the pin shows: a project open now can also have one upcoming.
  const engagementStates = useMemo(
    () =>
      periodsSettled
        ? engagementStatesByProject(openPeriods.data?.periods ?? [], upcomingPeriods.data ?? [])
        : undefined,
    [periodsSettled, openPeriods.data, upcomingPeriods.data],
  );
  const periodsError = openPeriods.error ?? upcomingPeriods.error;
  useEffect(() => {
    if (periodsError) logger.error('Error loading comment periods', 'Projects', periodsError);
  }, [periodsError]);

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

  const toggleRegion = useCallback(
    (polygonName: string): boolean => {
      const region = regions.find(
        (item: { _id: string; name: string }) =>
          (POLYGON_NAME[item.name] ?? item.name) === polygonName,
      );
      if (!region) return false;
      const picked = filters.regions.includes(region._id);
      const next = {
        ...filters,
        regions: picked
          ? filters.regions.filter((id) => id !== region._id)
          : [...filters.regions, region._id],
      };
      updateFilters({ regions: next.regions });
      trackFiltersApplied(next);
      // A pick that filters out the open project closes it, so it stops holding back the refit.
      const open = selectedId ? projectsById.get(selectedId) : undefined;
      if (open && !projectMatchesFilters(open, next, regions, engagementStates)) {
        setSelectedId(null);
      }
      return true;
    },
    [regions, filters, updateFilters, selectedId, projectsById, engagementStates],
  );

  const sort: ProjectSort = filters.sort ?? 'relevance';
  // Sorted here, before the map-bounds cut, so the list and the pins share one order.
  // A comment period filter waits for the periods, so the list never flashes every project first.
  const filterApps = useMemo(
    () =>
      matchedApps === null || (filters.commentPeriod && !periodsSettled)
        ? null
        : sortProjects(filterProjects(matchedApps, filters, regions, engagementStates), sort),
    [matchedApps, periodsSettled, filters, regions, engagementStates, sort],
  );
  const loading = filterApps === null;
  // Everything that reorders or narrows the list; the search box counts once its term settles.
  const orderKey = `${keywords}|${filtersToParams({ ...filters, applicant: null })}`;
  const emptyMessage =
    searchFailed || isError
      ? 'Projects could not be loaded right now.'
      : filters.commentPeriod && periodsError
        ? 'Comment periods could not be loaded right now.'
        : undefined;
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
          loading={loading}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={(project) =>
            setSelectedId((current) => (current === project._id ? null : project._id))
          }
          onHover={setHoveredId}
          mobile={mobile}
          engagementById={engagementById}
          emptyMessage={emptyMessage}
          status={sortNote}
          orderKey={orderKey}
          stale={search.isPlaceholderData}
          headerControl={
            <ProjlistSort
              sort={sort}
              onChange={(next) => {
                // Relevance is the default, so it leaves the URL clean.
                updateFilters({ sort: next === 'relevance' ? null : next });
                setSortNote(`Sorted by ${SORT_LABEL[next]}`);
              }}
            />
          }
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
            loading={loading}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={(project) => {
              setSelectedId(project?._id ?? null);
              // The card expands inside the list, so the sheet opens fully to show it.
              if (mobile && project) sheetState.set('full');
            }}
            onHover={setHoveredId}
            regionNames={regionNames}
            onRegionToggle={toggleRegion}
            mobile={mobile}
            engagementById={engagementById}
          />
        </Suspense>
      </div>
    </div>
  );
}
