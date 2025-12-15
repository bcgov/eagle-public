import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, signal, computed, ChangeDetectionStrategy, inject, Renderer2, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal, NgbModalRef, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import * as L from 'leaflet';

import { Project } from '../models/project';
import { ConfigService } from '../services/config.service';
import { ProjectService } from '../services/project.service';
import { CommentPeriodService } from '../services/commentperiod.service';
import { StorageService } from '../services/storage.service';
import { CommentPeriod } from '../models/commentperiod';
// TODO: Migrate these components
// import { AddCommentComponent } from '../comments/add-comment/add-comment';
// import { BecomeAMemberComponent } from './cac/become-a-member';
import { Constants } from '../shared/utils/constants';
import { SearchService } from '../services/search.service';
import { Utils } from '../shared/utils/utils';
import { DetailsSidebarComponent } from './details-sidebar/details-sidebar';
import { SafeHtmlPipe } from '../shared/pipes/safe-html-converter.pipe';

@Component({
  selector: 'app-project',
  imports: [
    CommonModule,
    RouterModule,
    NgbModule,
    DetailsSidebarComponent,
    SafeHtmlPipe
  ],
  templateUrl: './project.html',
  styleUrls: ['./project-lg-md.css', './project-sm.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  standalone: true
})
export class ProjectComponent implements OnInit, OnDestroy, AfterViewInit {
  private route = inject(ActivatedRoute);
  private storageService = inject(StorageService);
  private elementRef = inject(ElementRef);
  private router = inject(Router);
  private modalService = inject(NgbModal);
  private renderer = inject(Renderer2);
  private utils = inject(Utils);
  private searchService = inject(SearchService);
  public configService = inject(ConfigService);
  public projectService = inject(ProjectService);
  public commentPeriodService = inject(CommentPeriodService);

  public project = signal<Project | null>(null);
  public period = signal<CommentPeriod | null>(null);
  private ngbModal: NgbModalRef | null = null;
  public legislationLink = signal<string>('');
  public sidebarOpen = signal(true);

  public commentPeriod = signal<CommentPeriod | null>(null);
  public map: L.Map | null = null;
  public appFG = L.featureGroup();
  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]);

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

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
      .pipe(takeUntil(this.ngUnsubscribe))
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
    this.route.data
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        (data: any) => {
          const results = data?.project || null;
          if (results) {
            this.project.set(results);
            this.storageService.state.currentProject = { type: 'currentProject', data: results };
            this.renderer.removeClass(document.body, 'no-scroll');
          } else {
            alert('Uh-oh, couldn\'t load project');
            this.router.navigate(['/projects']);
          }
        }
      );

    this.initTabLinks();

    const proj = this.project();
    if (proj) {
      if (proj.legislation.includes('2002')) {
        this.legislationLink.set(Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK);
      } else if (proj.legislation.includes('1996')) {
        this.legislationLink.set(Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK);
      } else {
        this.legislationLink.set(Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK);
      }
    }
  }

  ngAfterViewInit() {
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
      zoomSnap: .1
    });

    this.map.addControl(new resetViewControl());
    L.control.zoom({ position: 'topleft' }).addTo(this.map);
    L.control.scale({ position: 'bottomright' }).addTo(this.map);

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

    const proj = this.project();
    if (proj) {
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
    }
    this.map.addLayer(this.appFG);

    this.fixMap();
  }

  private fixMap() {
    if (this.elementRef.nativeElement.offsetParent) {
      this.fitBounds(this.appFG.getBounds());
    } else {
      setTimeout(this.fixMap.bind(this), 50);
    }
  }

  public fitBounds(bounds: L.LatLngBounds | null = null) {
    const fitBoundsOptions: L.FitBoundsOptions = {
      animate: false,
      paddingBottomRight: [0, 35]
    };

    if (bounds && bounds.isValid()) {
      this.map?.fitBounds(bounds, fitBoundsOptions);
    } else {
      this.map?.fitBounds(this.defaultBounds, fitBoundsOptions);
    }
  }

  initTabLinks(): void {
    this.configService.lists.subscribe(list => {
      const currentTabs = this.tabLinks();
      currentTabs.forEach(tabLink => {
        if (!tabLink.display && tabLink.key !== Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC) {
          const tabModifier = this.utils.createProjectTabModifiers(tabLink.key, list);
          this.tabLinkIfNotEmpty(tabLink.key, tabModifier);
        }
      });
    });
  }

  public learnMore() {
    // TODO: Migrate BecomeAMemberComponent
    console.log('Learn more functionality requires BecomeAMemberComponent migration');
    // this.ngbModal = this.modalService.open(BecomeAMemberComponent, { backdrop: 'static', size: 'lg' });
    // const proj = this.project();
    // if (proj) {
    //   (this.ngbModal.componentInstance as BecomeAMemberComponent).project = proj;
    // }
    // this.ngbModal.result.then(
    //   value => {
    //     console.log(`Success, value = ${value}`);
    //   },
    //   reason => {
    //     console.log(`Cancelled, reason = ${reason}`);
    //   }
    // );
  }

  public addComment() {
    // TODO: Migrate AddCommentComponent
    console.log('Add comment functionality requires AddCommentComponent migration');
    // const proj = this.project();
    // if (proj?.commentPeriodForBanner) {
    //   this.ngbModal = this.modalService.open(AddCommentComponent, { backdrop: 'static', size: 'lg' });
    //   const instance = this.ngbModal.componentInstance as AddCommentComponent;
    //   instance.currentPeriod = proj.commentPeriodForBanner;
    //   instance.project = proj;
    //   this.ngbModal.result.then(
    //     value => {
    //       console.log(`Success, value = ${value}`);
    //     },
    //     reason => {
    //       console.log(`Cancelled, reason = ${reason}`);
    //     }
    //   );
    // }
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
    if (this.ngbModal) {
      this.ngbModal.dismiss('component destroyed');
    }
    if (this.map) {
      this.map.remove();
    }
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
