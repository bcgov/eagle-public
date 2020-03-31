import { Component, OnInit, Renderer2, ChangeDetectorRef, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/takeUntil';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import * as L from 'leaflet';

import { Project } from 'app/models/project';
import { ConfigService } from 'app/services/config.service';
import { ProjectService } from 'app/services/project.service';
import { CommentPeriodService } from 'app/services/commentperiod.service';
import { StorageService } from 'app/services/storage.service';
import { CommentPeriod } from 'app/models/commentperiod';
import { AddCommentComponent } from 'app/comments/add-comment/add-comment.component';
import { BecomeAMemberComponent } from './cac/become-a-member.component';
import { Constants } from 'app/shared/utils/constants';
import { SearchService } from 'app/services/search.service';
import { Utils } from 'app/shared/utils/utils';


@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project-lg-md.component.scss', './project-sm.component.scss']
})
export class ProjectComponent implements OnInit, OnDestroy, AfterViewInit {
  public project: Project = null;
  public period: CommentPeriod = null;
  private ngbModal: NgbModalRef = null;
  public legislationLink: String = '';
  public sidebarOpen = true;

  public commentPeriod = null;
  public map: L.Map = null;
  public appFG = L.featureGroup(); // group of layers for subject app
  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]); // all of BC

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public tabLinks: Array<any> = [
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
    // Any tabs that start off hidden (display = false) must have a key.
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
  ];

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private elementRef: ElementRef,
    private router: Router,
    private modalService: NgbModal,
    private _changeDetectionRef: ChangeDetectorRef,
    private renderer: Renderer2,
    private utils: Utils,
    private searchService: SearchService,
    public configService: ConfigService,
    public projectService: ProjectService, // used in template
    public commentPeriodService: CommentPeriodService // used in template
  ) { }

  // add an entry to this.tabLinks if the corresponding documents have been tagged
  // tablink is the label/link pair to append to this.tabLinks
  // queryModifier is the queryModifier parameter of SearchService.getSearchResults
  private tabLinkIfNotEmpty(key: string, queryModifier: object) {
    // attempt to get a single document that matches each query.
    if (queryModifier) {
      this.searchService.getSearchResults(
        null,
        'Document',
        [{ 'name': 'project', 'value': this.project._id }],
        1,
        1,
        null,
        queryModifier,
        true,
        ''
      )
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        // Display tab if there are results.
        if (res[0].data.searchResults.length) {
          // Accessing via reference to change the original array's value.
          const tab = this.tabLinks.find(docTab => docTab.key === key);
          tab.display = true;
        }
      })
    };
  }

  ngOnInit() {
    // get data from route resolver
    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        (data: { project: Project }) => {
          const results = data ?  data.project : null;
          if (results) {
            this.project = results;
            this.storageService.state.currentProject = { type: 'currentProject', data: this.project };
            this.renderer.removeClass(document.body, 'no-scroll');
            this._changeDetectionRef.detectChanges();
          } else {
            alert('Uh-oh, couldn\'t load project');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
        }
      );

    this.initTabLinks();

    if (this.project.legislation.includes('2002')) {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK;
    } else if  (this.project.legislation.includes('1996')) {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK;
    } else {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK;
    }
  }

  ngAfterViewInit() {
    const self = this; // for closure function below

    // custom control to reset map view
    const resetViewControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      onAdd: function () {
        const element = L.DomUtil.create('i', 'material-icons leaflet-bar leaflet-control leaflet-control-custom');

        element.title = 'Reset view';
        element.innerText = 'refresh'; // material icon name
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

        // prevent underlying map actions for these events
        L.DomEvent.disableClickPropagation(element); // includes double-click
        L.DomEvent.disableScrollPropagation(element);

        return element;
      },
    });

    // draw map
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
      zoomControl: false, // will be added manually below
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)), // restrict view to "the world"
      zoomSnap: .1 // for greater granularity when fitting bounds
    });

    // NB: don't need to handle map change events
    // since we always leave the subject app visible

    // add reset view control
    this.map.addControl(new resetViewControl());

    // add zoom control
    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // add scale control
    L.control.scale({ position: 'bottomright' }).addTo(this.map);

    // add base maps layers control
    const baseLayers = {
      'Ocean Base': Esri_OceanBasemap,
      'Nat Geo World Map': Esri_NatGeoWorldMap,
      'World Topographic': World_Topo_Map,
      'World Imagery': World_Imagery
    };
    L.control.layers(baseLayers).addTo(this.map);

    // load base layer
    for (const key of Object.keys(baseLayers)) {
      if (key === this.configService.baseLayerName) {
        this.map.addLayer(baseLayers[key]);
        break;
      }
    }

    // save any future base layer changes
    this.map.on('baselayerchange', function (e: L.LayersControlEvent) {
      this.configService.baseLayerName = e.name;
    }, this);

    // Disable zoom on project details - iterferes with scrolling page.
    this.map.scrollWheelZoom.disable();

    // draw project marker
    if (this.project) {
      const markerIconYellow = L.icon({
        iconUrl: 'assets/images/marker-icon-yellow.svg',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        tooltipAnchor: [16, -28]
      });

      const title = `${this.project.name}\n`
      + `${this.project.sector}\n`
      + `${this.project.location}\n`;
      const marker = L.marker(L.latLng(this.project.centroid[1], this.project.centroid[0]), { title: title })
        .setIcon(markerIconYellow);
      this.map.addLayer(marker);
    }
    this.map.addLayer(this.appFG);

    this.fixMap();
  }

  // to avoid timing conflict with animations (resulting in small map tile at top left of page),
  // ensure map component is visible in the DOM then update it; otherwise wait a bit...
  // ref: https://github.com/Leaflet/Leaflet/issues/4835
  // ref: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
  private fixMap() {
    if (this.elementRef.nativeElement.offsetParent) {
      this.fitBounds(this.appFG.getBounds());

    } else {
      setTimeout(this.fixMap.bind(this), 50);
    }
  }

  public fitBounds(bounds: L.LatLngBounds = null) {
    const fitBoundsOptions: L.FitBoundsOptions = {
      // disable animation to prevent known bug where zoom is sometimes incorrect
      // ref: https://github.com/Leaflet/Leaflet/issues/3249
      animate: false,
      // use bottom padding to keep shape in bounds
      paddingBottomRight: [0, 35]
    };

    if (bounds && bounds.isValid()) {
      this.map.fitBounds(bounds, fitBoundsOptions);
    } else {
      this.map.fitBounds(this.defaultBounds, fitBoundsOptions);
    }
  }

  initTabLinks(): void {
    this.configService.lists.subscribe (list => {
      this.tabLinks.forEach(tabLink => {
        if (!tabLink.display && tabLink.key !== Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC) {
          const tabModifier = this.utils.createProjectTabModifiers(tabLink.key, list);
          this.tabLinkIfNotEmpty(tabLink.key, tabModifier);
        }
      });
    });
  }

  public learnMore() {
    this.ngbModal = this.modalService.open(BecomeAMemberComponent, { backdrop: 'static', size: 'lg' });
    // set input parameter
    (<BecomeAMemberComponent>this.ngbModal.componentInstance).project = this.project;
    // check result
    this.ngbModal.result.then(
      value => {
        // saved
        console.log(`Success, value = ${value}`);
      },
      reason => {
        // cancelled
        console.log(`Cancelled, reason = ${reason}`);
      }
    );
  }


  public addComment() {
    if (this.project.commentPeriodForBanner) {
      // open modal
      this.ngbModal = this.modalService.open(AddCommentComponent, { backdrop: 'static', size: 'lg' });
      // set input parameter
      (<AddCommentComponent>this.ngbModal.componentInstance).currentPeriod = this.project.commentPeriodForBanner;
      (<AddCommentComponent>this.ngbModal.componentInstance).project = this.project;
      // check result
      this.ngbModal.result.then(
        value => {
          // saved
          console.log(`Success, value = ${value}`);
        },
        reason => {
          // cancelled
          console.log(`Cancelled, reason = ${reason}`);
        }
      );
    }
  }

  public goToViewComments() {
    this.router.navigate(['/p', this.project._id, 'cp', this.project.commentPeriodForBanner._id, 'details']);
  }

  public handleSidebarToggle(event) {
    this.sidebarOpen = event.open;
  }

  ngOnDestroy() {
    if (this.ngbModal) { this.ngbModal.dismiss('component destroyed'); }
    if (this.map) { this.map.remove(); }
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
