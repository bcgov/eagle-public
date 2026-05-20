import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, signal, ChangeDetectionStrategy, inject, Renderer2, CUSTOM_ELEMENTS_SCHEMA, effect, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterModule, NavigationEnd } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, take, map, catchError } from 'rxjs/operators';

import { Project } from '../models/project';
import { ConfigService } from '../services/config.service';
import { ProjectService } from '../services/project.service';
import { CommentPeriodService } from '../services/commentperiod.service';
import { StorageService } from '../services/storage.service';
import { CommentPeriod } from '../models/commentperiod';
import { Constants } from '../shared/utils/constants';
import { initTabArrows, TabArrowsHandle } from '../shared/utils/tab-arrows';
import { SearchService } from '../services/search.service';
import { TypesenseService } from '../services/typesense.service';
import { TAB_FILTER_BY } from '../search/search-collections';
import { Utils } from '../shared/utils/utils';
import { DetailsSidebarComponent } from './details-sidebar/details-sidebar';
import { SafeHtmlPipe } from '../shared/pipes/safe-html-converter.pipe';
import { LoggingService } from '../services/logging.service';
import { AnalyticsService } from '../services/analytics/analytics.service';

@Component({
  selector: 'app-project',
  imports: [
    DatePipe,
    RouterModule,
    DetailsSidebarComponent,
    SafeHtmlPipe
  ],
  templateUrl: './project.html',
  styleUrl: './project.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    '(window:resize)': 'onResize($event)'
  },
})
export class ProjectComponent implements OnInit, OnDestroy, AfterViewInit {
  private route = inject(ActivatedRoute);
  private storageService = inject(StorageService);
  private elementRef = inject(ElementRef);
  private router = inject(Router);
  private renderer = inject(Renderer2);
  private utils = inject(Utils);
  private searchService = inject(SearchService);
  private typesenseService = inject(TypesenseService);
  private logger = inject(LoggingService);
  private analytics = inject(AnalyticsService);
  public configService = inject(ConfigService);
  public projectService = inject(ProjectService);
  public commentPeriodService = inject(CommentPeriodService);

  public project = signal<Project | null>(null);
  public period = signal<CommentPeriod | null>(null);
  public commentPeriod = signal<CommentPeriod | null>(null);
  public legislationLink = signal<string>('');
  public sidebarOpen = signal(true);
  public isLoading = signal(true);
  public tabsLoading = signal(false);
  public currentTab = signal<string>(this.router.url.split('/').pop() ?? '');
  private tabArrowsHandle: TabArrowsHandle | null = null;

  public map: any = null;
  public appFG = L.featureGroup();
  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]);
  private mapRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor() {
    // Initialize tab links when project data loads.
    // untracked() prevents signal reads inside initTabLinks (tabLinks, tabsLoading)
    // from becoming effect dependencies — otherwise tabLinks.set() in the forkJoin
    // callback would reschedule the effect, creating an infinite request loop.
    effect(() => {
      const proj = this.project();
      if (proj?._id) {
        untracked(() => this.initTabLinks());
        
        // Set legislation link based on year
        const leg = proj.legislation;
        this.legislationLink.set(
          leg.includes('2002') ? Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK
          : leg.includes('1996') ? Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK
          : Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK
        );
        
        // Re-check tab arrows after tabs are updated
        setTimeout(() => this.tabArrowsHandle?.check(), 100);
      }
    });
  }

  private loadProject(projId: string) {
    const start = new Date();
    const end = new Date();
    start.setDate(start.getDate() - 21);
    end.setDate(end.getDate() + 14);
    // Use date-only strings (YYYY-MM-DD) so the URL is stable within a day and
    // the HTTP cache interceptor can serve repeat visits without a network call.
    const cpStart = start.toISOString().slice(0, 10);
    const cpEnd = end.toISOString().slice(0, 10);

    this.isLoading.set(true);
    this.projectService.getById(projId, false, cpStart, cpEnd)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (project) => {
          if (project) {
            this.project.set(project);
            this.storageService.state = { type: 'currentProject', data: project };
            this.renderer.removeClass(document.body, 'no-scroll');
            this.isLoading.set(false);
            setTimeout(() => this.initMap(), 0);
          } else {
            this.handleProjectLoadError();
          }
        },
        error: () => {
          this.isLoading.set(false);
          this.handleProjectLoadError();
        }
      });
  }

  private handleProjectLoadError() {
    alert('Uh-oh, couldn\'t load project');
    this.router.navigate(['/projects']);
  }

  public tabLinks = signal<any[]>([
    {
      label: 'Project Details',
      link: 'project-details',
      tabDisplayCriteria: null,
      display: true,
    },
    {
      label: 'Commenting',
      link: 'commenting',
      tabDisplayCriteria: null,
      display: true,
    },
    {
      label: 'Documents',
      link: 'documents',
      tabDisplayCriteria: null,
      display: true,
    },
    {
      key: Constants.optionalProjectDocTabs.APPLICATION,
      label: 'Applications',
      link: 'application',
      tabDisplayCriteria: null,
      display: false,
    },
    {
      key: Constants.optionalProjectDocTabs.CERTIFICATE,
      label: 'Certificates',
      link: 'certificates',
      tabDisplayCriteria: null,
      display: false,
    },
    {
      key: Constants.optionalProjectDocTabs.AMENDMENT,
      label: 'Amendments',
      link: 'amendments',
      tabDisplayCriteria: null,
      display: false,
    },
    {
      key: Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC,
      label: 'Unsubscribe',
      link: Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC,
      tabDisplayCriteria: null,
      display: false,
    }
  ]);

  ngOnInit() {
    // Get project ID from route params
    this.route.paramMap
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(params => {
        const projId = params.get('projId');
        if (projId && this.project()?._id !== projId) {
          // Prime storageService immediately with the project ID so child tabs
          // (commenting, documents) fire their own API calls in parallel with
          // the project load, rather than waiting for it to finish.
          if (this.storageService.currentProject()?._id !== projId) {
            this.storageService.state = { type: 'currentProject', data: { _id: projId } as Project };
          }
          this.loadProject(projId);
        }
      });
    
    // Re-check tab arrows when route changes; track active tab segment
    this.router.events
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.currentTab.set(event.urlAfterRedirects.split('/').pop() ?? '');
          setTimeout(() => this.tabArrowsHandle?.check(), 100);
        }
      });
  }

  ngAfterViewInit() {
    this.tabArrowsHandle = initTabArrows();
  }



  onResize(_event?: Event) {
    if (this.map) {
      this.map.invalidateSize();
      this.fitBounds(this.appFG.getBounds());
    }
  }

  private initMap() {
    if (this.map) {
      return; // Guard against double-call when concat emits two project values
    }
    // No centroid = no map needed; bail immediately so we never retry
    const proj = this.project();
    if (!proj || !proj.centroid || proj.centroid.length !== 2) {
      return;
    }
    // Check if map element exists (may not be in DOM yet on first render)
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      this.mapRetryTimeout = setTimeout(() => this.initMap(), 100);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const resetViewControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      onAdd: function () {
        const element = L.DomUtil.create('i', 'material-icons leaflet-bar leaflet-control leaflet-control-custom');

        element.title = 'Reset view';
        element.innerText = 'refresh';
        element.style.width = '34px';
        element.style.height = '20%';
        element.style.lineHeight = '30px';
        element.style.textAlign = 'center';
        element.style.cursor = 'pointer';
        element.style.backgroundColor = '#fff';
        element.style.color = '#333';
        element.onmouseover = () => element.style.backgroundColor = '#f4f4f4';
        element.onmouseout = () => element.style.backgroundColor = '#fff';

        element.onclick = function () {
          self.analytics.track('Map Reset View Clicked', {
            project_id: self.project()?._id || null,
            project_name: self.project()?.name || null
          });
          self.fitBounds(self.appFG.getBounds());
        };

        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);

        return element;
      },
    });

    const Esri_OceanBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
      maxZoom: 13,
      noWrap: true
    });
    const Esri_NatGeoWorldMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
      maxZoom: 16,
      noWrap: true
    });
    const World_Topo_Map = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
      maxZoom: 16,
      noWrap: true
    });
    const World_Imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 17,
      noWrap: true
    });

    this.map = L.map('map', {
      zoomControl: false,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      zoomSnap: .1,
      attributionControl: false
    });

    this.map.addControl(new resetViewControl());
    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    const baseLayers = {
      'Ocean Base': Esri_OceanBasemap,
      'Nat Geo World Map': Esri_NatGeoWorldMap,
      'World Topographic': World_Topo_Map,
      'World Imagery': World_Imagery
    };
    L.control.layers(baseLayers).addTo(this.map);

    for (const key of Object.keys(baseLayers)) {
      if (key === this.configService.baseLayerName) {
        this.map.addLayer(baseLayers[key as keyof typeof baseLayers]);
        break;
      }
    }

    const configService = this.configService;
    const analytics = this.analytics;
    const getProject = () => this.project();
    
    this.map.on('baselayerchange', function (e: any) {
      configService.baseLayerName = e.name;
      const proj = getProject();
      if (proj) {
        analytics.track('Map Base Layer Changed', {
          project_id: proj._id,
          project_name: proj.name,
          layer_name: e.name
        });
      }
    });

    this.map.scrollWheelZoom.disable();

    // Add marker if project has valid centroid
    if (proj && proj.centroid && proj.centroid.length === 2) {
      const markerIconYellow = L.icon({
        iconUrl: 'assets/images/marker-icon-yellow.svg',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        tooltipAnchor: [16, -28]
      });

      const title = `${proj.name}\n${proj.sector}\n${proj.location}\n`;
      const marker = L.marker(L.latLng(proj.centroid[1], proj.centroid[0]), { title: title })
        .setIcon(markerIconYellow);
      
      // Track marker click
      marker.on('click', () => {
        this.analytics.track('Map Marker Clicked', {
          project_id: proj._id,
          project_name: proj.name,
          map_zoom_level: this.map.getZoom()
        });
      });
      
      this.map.addLayer(marker);
      this.appFG.addLayer(marker);
      
      // Center map on the marker at zoom level 8
      this.map.setView([proj.centroid[1], proj.centroid[0]], 8);
    }
    
    this.map.addLayer(this.appFG);

    this.fixMap();
  }

  private fixMap() {
    if (this.elementRef.nativeElement.offsetParent) {
      const proj = this.project();
      if (proj && proj.centroid && proj.centroid.length === 2) {
        // Center on marker instead of fitting bounds
        this.map?.setView([proj.centroid[1], proj.centroid[0]], 8);
      } else {
        this.fitBounds(this.appFG.getBounds());
      }
      // Invalidate map size after container is properly rendered
      setTimeout(() => {
        this.map?.invalidateSize();
        if (proj && proj.centroid && proj.centroid.length === 2) {
          this.map?.setView([proj.centroid[1], proj.centroid[0]], 8);
        } else {
          this.fitBounds(this.appFG.getBounds());
        }
      }, 100);
    } else {
      setTimeout(this.fixMap.bind(this), 50);
    }
  }

  public fitBounds(bounds: any = null) {
    const fitBoundsOptions = {
      animate: false,
      paddingBottomRight: [0, 35],
      padding: [50, 50],
      maxZoom: 8
    };

    if (bounds && bounds.isValid()) {
      this.map?.fitBounds(bounds, fitBoundsOptions);
    } else {
      this.map?.fitBounds(this.defaultBounds, fitBoundsOptions);
    }
  }

  initTabLinks(): void {
    const projectId = this.project()?._id;
    if (!projectId) return;

    const optionalTabs = this.tabLinks().filter(
      t => !t.display && t.key !== Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC
    );
    if (optionalTabs.length === 0) return;

    this.tabsLoading.set(true);

    // When Typesense is enabled, check tab visibility with per_page=0 count queries
    // (no documents returned — just `found` count). Far faster than MongoDB searches
    // and avoids competing with the document-table multi_search for proxy connections.
    if (this.configService.config().TYPESENSE_ENABLED) {
      const checks$ = optionalTabs.map(tabLink => {
        const filterBy = TAB_FILTER_BY[tabLink.key];
        if (!filterBy) return of({ key: tabLink.key, hasResults: false });

        return this.typesenseService.searchCollection('documents', {
          q: '*',
          query_by: 'displayName',
          filter_by: `projectId:=${projectId} && ${filterBy}`,
          per_page: '0',
        }).pipe(
          take(1),
          map((res: any) => ({ key: tabLink.key, hasResults: (res.found ?? 0) > 0 })),
          catchError(() => of({ key: tabLink.key, hasResults: false }))
        );
      });

      this.applyTabChecks(checks$);
      return;
    }

    // MongoDB fallback — used when TYPESENSE_ENABLED is false.
    this.configService.lists.pipe(
      take(1),
      takeUntil(this.ngUnsubscribe)
    ).subscribe(list => {
      const checks$ = optionalTabs.map(tabLink => {
        const queryModifier = this.utils.createProjectTabModifiers(tabLink.key, list);
        if (!queryModifier) return of({ key: tabLink.key, hasResults: false });

        return this.searchService.getSearchResults(
          '', 'Document',
          [{ name: 'project', value: projectId }],
          1, 1, '', queryModifier, true, ''
        ).pipe(
          take(1),
          map((res: any) => ({
            key: tabLink.key,
            hasResults: !!res?.[0]?.data?.searchResults?.length
          })),
          catchError(() => of({ key: tabLink.key, hasResults: false }))
        );
      });

      this.applyTabChecks(checks$);
    });
  }

  private applyTabChecks(checks$: Observable<{ key: string; hasResults: boolean }>[]): void {
    forkJoin(checks$)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(results => {
        const currentTabs = this.tabLinks();
        let changed = false;
        results.forEach(({ key, hasResults }) => {
          if (hasResults) {
            const tab = currentTabs.find(t => t.key === key);
            if (tab && !tab.display) { tab.display = true; changed = true; }
          }
        });
        if (changed) this.tabLinks.set([...currentTabs]);
        this.tabsLoading.set(false);
      });
  }

  public goToViewComments() {
    const proj = this.project();
    if (proj?.commentPeriodForBanner?.isMet && proj.commentPeriodForBanner.metURL) {
      this.analytics.track('Comment Period Banner Clicked', {
        project_id: proj._id,
        project_name: proj.name,
        status: proj.commentPeriodForBanner.commentPeriodStatus,
        is_met: true,
        destination: 'external_met'
      });
      window.open(proj.commentPeriodForBanner.metURL, '_blank');
    } else if (proj?.commentPeriodForBanner) {
      this.analytics.track('Comment Period Banner Clicked', {
        project_id: proj._id,
        project_name: proj.name,
        status: proj.commentPeriodForBanner.commentPeriodStatus,
        is_met: false,
        destination: 'comment_period_details'
      });
      this.router.navigate(['/p', proj._id, 'cp', proj.commentPeriodForBanner._id, 'details']);
    }
  }

  public handleSidebarToggle(event: { open: boolean }) {
    this.sidebarOpen.set(event.open);
  }

  public trackTabClick(tabLink: any) {
    const proj = this.project();
    if (proj) {
      this.analytics.track('Project Tab Clicked', {
        project_id: proj._id,
        project_name: proj.name,
        tab_name: tabLink.label,
        tab_path: tabLink.link
      });
    }
  }

  ngOnDestroy() {
    if (this.mapRetryTimeout !== null) {
      clearTimeout(this.mapRetryTimeout);
    }
    if (this.map) {
      this.map.remove();
    }
    this.tabArrowsHandle?.cleanup();
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
