import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, signal, ChangeDetectionStrategy, inject, Renderer2, CUSTOM_ELEMENTS_SCHEMA, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';
import * as L from 'leaflet';

import { Project } from '../models/project';
import { ConfigService } from '../services/config.service';
import { ProjectService } from '../services/project.service';
import { CommentPeriodService } from '../services/commentperiod.service';
import { StorageService } from '../services/storage.service';
import { CommentPeriod } from '../models/commentperiod';
import { Constants } from '../shared/utils/constants';
import { SearchService } from '../services/search.service';
import { Utils } from '../shared/utils/utils';
import { DetailsSidebarComponent } from './details-sidebar/details-sidebar';
import { SafeHtmlPipe } from '../shared/pipes/safe-html-converter.pipe';
import { LoggingService } from '../services/logging.service';

@Component({
  selector: 'app-project',
  imports: [
    CommonModule,
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
  standalone: true
})
export class ProjectComponent implements OnInit, OnDestroy, AfterViewInit {
  private route = inject(ActivatedRoute);
  private storageService = inject(StorageService);
  private elementRef = inject(ElementRef);
  private router = inject(Router);
  private renderer = inject(Renderer2);
  private utils = inject(Utils);
  private searchService = inject(SearchService);
  private logger = inject(LoggingService);
  public configService = inject(ConfigService);
  public projectService = inject(ProjectService);
  public commentPeriodService = inject(CommentPeriodService);

  public project = signal<Project | null>(null);
  public period = signal<CommentPeriod | null>(null);
  public commentPeriod = signal<CommentPeriod | null>(null);
  public legislationLink = signal<string>('');
  public sidebarOpen = signal(true);
  private checkTabArrowsFn: (() => void) | null = null;

  public map: L.Map | null = null;
  public appFG = L.featureGroup();
  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]);

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor() {
    // Initialize tab links when project data loads
    effect(() => {
      const proj = this.project();
      if (proj?._id) {
        this.initTabLinks();
        
        // Set legislation link based on year
        const legislationYear = proj.legislation.includes('2002') ? '2002' 
          : proj.legislation.includes('1996') ? '1996' 
          : '2018';
        
        const legislationLinks: Record<string, string> = {
          '2002': Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK,
          '1996': Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK,
          '2018': Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK
        };
        
        this.legislationLink.set(legislationLinks[legislationYear]);
        
        // Re-check tab arrows after tabs are updated
        setTimeout(() => this.checkTabArrowsVisibility(), 100);
      }
    });
  }

  private loadProject(projId: string) {
    const start = new Date();
    const end = new Date();
    start.setDate(start.getDate() - 21);
    end.setDate(end.getDate() + 14);
    
    this.projectService.getById(projId, false, start.toISOString(), end.toISOString())
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (project) => {
          if (project) {
            this.project.set(project);
            this.storageService.state = { type: 'currentProject', data: project };
            this.renderer.removeClass(document.body, 'no-scroll');
            setTimeout(() => this.initMap(), 0);
          } else {
            this.handleProjectLoadError();
          }
        },
        error: () => this.handleProjectLoadError()
      });
  }

  private handleProjectLoadError() {
    alert('Uh-oh, couldn\'t load project');
    this.router.navigate(['/projects']);
  }

  public tabLinks = signal<Array<any>>([
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
      label: 'Application',
      link: 'application',
      tabDisplayCriteria: null,
      display: false,
    },
    {
      key: Constants.optionalProjectDocTabs.CERTIFICATE,
      label: 'Certificate',
      link: 'certificates',
      tabDisplayCriteria: null,
      display: false,
    },
    {
      key: Constants.optionalProjectDocTabs.AMENDMENT,
      label: 'Amendment(s)',
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

  private tabLinkIfNotEmpty(key: string, queryModifier: Record<string, string>) {
    if (queryModifier) {
      const projectId = this.project()?._id;
      if (!projectId) return;
      
      // Only fetch if tab is not already displayed
      const tab = this.tabLinks().find(docTab => docTab.key === key);
      if (tab?.display) return;
      
      this.searchService.getSearchResults(
        '',
        'Document',
        [{ 'name': 'project', 'value': projectId }],
        1,
        1,
        '',
        queryModifier,
        true,
        ''
      )
      .pipe(take(1))
      .subscribe((res: any) => {
        if (res[0].data.searchResults.length) {
          const currentTabs = this.tabLinks();
          const tab = currentTabs.find(docTab => docTab.key === key);
          if (tab) {
            tab.display = true;
            this.tabLinks.set([...currentTabs]);
          }
        }
      });
    }
  }

  ngOnInit() {
    // Get project ID from route params
    this.route.paramMap
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(params => {
        const projId = params.get('projId');
        if (projId && this.project()?._id !== projId) {
          this.loadProject(projId);
        }
      });
    
    // Re-check tab arrows when route changes
    this.router.events
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(event => {
        if (event instanceof NavigationEnd) {
          setTimeout(() => this.checkTabArrowsVisibility(), 100);
        }
      });
  }

  ngAfterViewInit() {
    // Initialize tab navigation arrows for overflow
    this.initTabArrows();
  }

  private initTabArrows() {
    const tabsContainer = document.querySelector('.tabs-container') as HTMLElement;
    const navTabs = document.querySelector('.nav-tabs') as HTMLElement;
    if (!tabsContainer || !navTabs) {
      setTimeout(() => this.initTabArrows(), 100);
      return;
    }
    
    // Avoid creating duplicate arrows
    if (tabsContainer.querySelector('.tab-arrow')) {
      return;
    }

    const { leftArrow, rightArrow } = this.createArrowElements(tabsContainer);
    const checkArrows = this.createScrollChecker(navTabs, leftArrow, rightArrow);
    this.setupArrowHandlers(navTabs, leftArrow, rightArrow, checkArrows);
  }

  private createArrowElements(container: HTMLElement) {
    const leftArrow = document.createElement('button');
    leftArrow.className = 'tab-arrow tab-arrow-left';
    leftArrow.innerHTML = '&#8249;';
    leftArrow.setAttribute('aria-label', 'Scroll tabs left');
    leftArrow.type = 'button';

    const rightArrow = document.createElement('button');
    rightArrow.className = 'tab-arrow tab-arrow-right';
    rightArrow.innerHTML = '&#8250;';
    rightArrow.setAttribute('aria-label', 'Scroll tabs right');
    rightArrow.type = 'button';

    container.appendChild(leftArrow);
    container.appendChild(rightArrow);

    return { leftArrow, rightArrow };
  }

  private createScrollChecker(navTabs: HTMLElement, leftArrow: HTMLButtonElement, rightArrow: HTMLButtonElement) {
    const adjustArrowPosition = () => {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      rightArrow.style.right = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '0px';
    };

    const checkArrows = () => {
      const hasOverflow = navTabs.scrollWidth > navTabs.clientWidth;
      const isAtStart = navTabs.scrollLeft <= 1;
      const isAtEnd = navTabs.scrollLeft >= navTabs.scrollWidth - navTabs.clientWidth - 1;
      
      leftArrow.style.display = hasOverflow && !isAtStart ? 'flex' : 'none';
      rightArrow.style.display = hasOverflow && !isAtEnd ? 'flex' : 'none';
      
      adjustArrowPosition();
    };
    
    this.checkTabArrowsFn = checkArrows;
    return checkArrows;
  }

  private setupArrowHandlers(navTabs: HTMLElement, leftArrow: HTMLButtonElement, rightArrow: HTMLButtonElement, checkArrows: () => void) {
    leftArrow.addEventListener('click', () => {
      navTabs.scrollBy({ left: -200, behavior: 'smooth' });
      setTimeout(checkArrows, 100);
    });

    rightArrow.addEventListener('click', () => {
      navTabs.scrollBy({ left: 200, behavior: 'smooth' });
      setTimeout(checkArrows, 100);
    });

    navTabs.addEventListener('scroll', checkArrows);
    
    // Use ResizeObserver for responsive checking
    const resizeObserver = new ResizeObserver(() => checkArrows());
    resizeObserver.observe(navTabs);
    
    // Initial check
    setTimeout(() => checkArrows(), 0);
  }

  private checkTabArrowsVisibility() {
    if (this.checkTabArrowsFn) {
      this.checkTabArrowsFn();
    }
  }

  onResize(event?: Event) {
    if (this.map) {
      this.map.invalidateSize();
      this.fitBounds(this.appFG.getBounds());
    }
  }

  private initMap() {
    // Check if map element exists
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      this.logger.warn('Map element not found, retrying...', 'ProjectComponent');
      setTimeout(() => this.initMap(), 100);
      return;
    }

    // Check if project has valid centroid
    const proj = this.project();
    if (!proj || !proj.centroid || proj.centroid.length !== 2) {
      this.logger.info('No valid centroid for map display', 'ProjectComponent');
      return;
    }

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
        element.onmouseover = () => element.style.backgroundColor = '#f4f4f4';
        element.onmouseout = () => element.style.backgroundColor = '#fff';

        element.onclick = function () {
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
    this.map.on('baselayerchange', function (e: L.LayersControlEvent) {
      configService.baseLayerName = e.name;
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
      this.map.addLayer(marker);
      this.appFG.addLayer(marker);
    }
    
    this.map.addLayer(this.appFG);

    this.fixMap();
  }

  private fixMap() {
    if (this.elementRef.nativeElement.offsetParent) {
      this.fitBounds(this.appFG.getBounds());
      // Invalidate map size after container is properly rendered
      setTimeout(() => {
        this.map?.invalidateSize();
        this.fitBounds(this.appFG.getBounds());
      }, 100);
    } else {
      setTimeout(this.fixMap.bind(this), 50);
    }
  }

  public fitBounds(bounds: L.LatLngBounds | null = null) {
    const fitBoundsOptions: L.FitBoundsOptions = {
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
    this.configService.lists.pipe(
      take(1),
      takeUntil(this.ngUnsubscribe)
    ).subscribe(list => {
      const currentTabs = this.tabLinks();
      currentTabs.forEach(tabLink => {
        if (!tabLink.display && tabLink.key !== Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC) {
          const tabModifier = this.utils.createProjectTabModifiers(tabLink.key, list);
          this.tabLinkIfNotEmpty(tabLink.key, tabModifier);
        }
      });
    });
  }

  public goToViewComments() {
    const proj = this.project();
    if (proj?.commentPeriodForBanner?.isMet && proj.commentPeriodForBanner.metURL) {
      window.open(proj.commentPeriodForBanner.metURL, '_blank');
    } else if (proj?.commentPeriodForBanner) {
      this.router.navigate(['/p', proj._id, 'cp', proj.commentPeriodForBanner._id, 'details']);
    }
  }

  public handleSidebarToggle(event: { open: boolean }) {
    this.sidebarOpen.set(event.open);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
