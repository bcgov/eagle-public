import { Component, AfterViewInit, OnChanges, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { ApplicationRef, ElementRef, SimpleChanges, Injector, ComponentFactoryResolver } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import 'leaflet';
import 'leaflet.markercluster';
import * as _ from 'lodash';

import { Project } from 'app/models/project';
import { ProjectService } from 'app/services/project.service';
import { ConfigService } from 'app/services/config.service';
import { ProjDetailPopupComponent } from 'app/projects/proj-detail-popup/proj-detail-popup.component';

declare module 'leaflet' {
  export interface FeatureGroup<P = any> {
    projectId: number;
  }
  export interface Marker<P = any> {
    projectId: number;
  }
}

const L = window['L'];

const markerIconYellow = L.icon({
  iconUrl: 'assets/images/marker-icon-yellow.svg',
  // Retina Icon is not needed here considering we're using an SVG. Enable if you want to change to a raster asset.
  // iconRetinaUrl: 'assets/images/marker-icon-2x-yellow.svg',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  tooltipAnchor: [16, -28]
});

const markerIconYellowLg = L.icon({
  iconUrl: 'assets/images/marker-icon-yellow-lg.svg',
  // Retina Icon is not needed here considering we're using an SVG. Enable if you want to change to a raster asset.
  // iconRetinaUrl: 'assets/images/marker-icon-yellow-lg.svg',
  iconSize: [48, 48],
  iconAnchor: [24, 48],
  // popupAnchor: [1, -34], // TODO: update, if needed
  // tooltipAnchor: [16, -28] // TODO: update, if needed
});

@Component({
  selector: 'app-projlist-map',
  templateUrl: './projlist-map.component.html',
  styleUrls: ['./projlist-map.component.scss']
})

export class ProjlistMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  // NB: this component is bound to the same list of apps as the other components
  @Input() projects: Array<Project> = []; // from projects component
  @Input() applist; // from projects component
  @Input() appfilters; // from projects component
  @Output() updateVisible = new EventEmitter(); // to projects component
  @Output() reloadApps = new EventEmitter(); // to projects component

  private map: L.Map = null;
  private markerList: Array<L.Marker> = []; // list of markers
  private currentMarker: L.Marker = null; // for removing previous marker
  private markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40, // NB: change to 0 to disable clustering
    // iconCreateFunction: this.clusterCreate // FUTURE: for custom markers, if needed
  });
  public loading = false;
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]); // all of BC

  constructor(
    private appRef: ApplicationRef,
    private elementRef: ElementRef,
    public projectService: ProjectService,
    public configService: ConfigService,
    private injector: Injector,
    private resolver: ComponentFactoryResolver
  ) { }

  // // for creating custom cluster icon
  // private clusterCreate(cluster): L.Icon | L.DivIcon {
  //   const html = cluster.getChildcount().toString();
  //   return L.divIcon({ html: html, className: 'my-cluster', iconSize: L.point(40, 40) });
  // }

  // create map after view (which contains map id) is initialized
  ngAfterViewInit() {
    const self = this; // for closure function below

    // custom control to reset map view
    const resetViewControl = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      onAdd: function () {
        const element = L.DomUtil.create('button');

        element.title = 'Reset view';
        element.innerText = 'refresh'; // material icon name
        element.onclick = () => self.resetView();
        element.className = 'material-icons map-reset-control';

        // prevent underlying map actions for these events
        L.DomEvent.disableClickPropagation(element); // includes double-click
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
    // TODO update or remove this layer, now requires a token to use
    // const OpenMapSurfer_Roads = L.tileLayer('https://korona.geog.uni-heidelberg.de/tiles/roads/x={x}&y={y}&z={z}', {
    //   attribution: 'Imagery from <a href="http://giscience.uni-hd.de/">GIScience Research Group @ University of Heidelberg</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    //   maxZoom: 20,
    //   noWrap: true
    // });
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
      zoomSnap: 0.1, // for greater granularity when fitting bounds
      attributionControl: false
    });

    // map state change events
    // this.map.on('zoomstart', function () {
    //   console.log('zoomstart');
    // }, this);

    // this.map.on('movestart', function () {
    //   console.log('movestart');
    // }, this);

    // this.map.on('resize', function () {
    //   console.log('resize');
    // }, this);

    // NB: moveend is called after zoomstart, movestart and resize
    this.map.on('moveend', function () {
      // console.log('moveend');
      this.setVisibleDebounced();
    }, this);

    // add markers group
    this.map.addLayer(this.markerClusterGroup);


    // add base maps layers control
    const baseLayers = {
      'Ocean Base': Esri_OceanBasemap,
      'Nat Geo World Map': Esri_NatGeoWorldMap,
      // 'Open Surfer Roads': OpenMapSurfer_Roads,
      'World Topographic': World_Topo_Map,
      'World Imagery': World_Imagery
    };
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(this.map);

    // map attribution
    L.control.attribution({position: 'bottomright'}).addTo(this.map);

    // add scale control
    L.control.scale({ position: 'bottomleft' }).addTo(this.map);

    // add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // add reset view control
    this.map.addControl(new resetViewControl());

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

    this.fixMap();
  }

  // to avoid timing conflict with animations (resulting in small map tile at top left of page),
  // ensure map component is visible in the DOM then update it; otherwise wait a bit...
  // ref: https://github.com/Leaflet/Leaflet/issues/4835
  // ref: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
  private fixMap() {
    if (this.elementRef.nativeElement.offsetParent) {
      this.fitBounds(); // use default bounds

      // FUTURE: restore map bounds here ?
      // this.fitBounds(this.configService.mapBounds);
    } else {
      setTimeout(this.fixMap.bind(this), 50);
    }
  }

  // called when apps list changes
  public ngOnChanges(changes: SimpleChanges) {
    if (changes.projects && !changes.projects.firstChange && changes.projects.currentValue) {
      // console.log('map: got filtered apps from filters component');
      // console.log('# filtered apps =', this.projects.length);

      const deletedApps = _.difference(changes.projects.previousValue, changes.projects.currentValue) as Array<Project>;
      const addedApps = _.difference(changes.projects.currentValue, changes.projects.previousValue) as Array<Project>;

      // (re)draw the matching apps
      this.drawMap(deletedApps, addedApps);
    }
  }

  public ngOnDestroy() {
    if (this.map) { this.map.remove(); }
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  /**
    * Resets map view.
    */
  private resetView() {
    // console.log('resetting view');
    this.fitBounds(); // use default bounds
    // this.reloadApps.emit(); // FUTURE: reload apps ?
  }

  /**
   * Sets which apps are currently visible.
   * Actual function executes no more than once every 250ms.
   */
  // tslint:disable-next-line:member-ordering
  private setVisibleDebounced = _.debounce(this.setVisible, 250);

  /**
   * NB: Call setVisibleDebounced() instead!
   */
  private setVisible() {
    // console.log('setting visible');
    const mapBounds = this.map.getBounds();

    // FUTURE: save map bounds here ?
    // this.configService.mapBounds = mapBounds;

    // update visibility for apps with markers only
    // ie, leave apps without markers 'visible' (as initialized)
    for (const marker of this.markerList) {
      const app = _.find(this.projects, { _id: marker.projectId });
      if (app) {
        const markerLatLng = marker.getLatLng();
        // app is visible if map contains its marker
        app.isVisible = mapBounds.contains(markerLatLng);

        // If there is only one result from the filter
        // force the popup to auto-display
        if (this.markerList.length === 1 && app.isVisible) {
          if (marker.getPopup()) {
            marker.openPopup();
          } else {
            // create the popup
            this.createMarkerPopup(app, marker);
            marker.openPopup();
          }
        }

      }
    }

    // notify list component
    this.updateVisible.emit();
  }

  private fitBounds(bounds: L.LatLngBounds = null) {
    // console.log('fitting bounds');
    const fitBoundsOptions: L.FitBoundsOptions = {
      // use top padding to adjust for filters header (which is always visible)
      paddingTopLeft: L.point(0, this.appfilters.clientHeight),
      // disable animation to prevent known bug where zoom is sometimes incorrect
      // ref: https://github.com/Leaflet/Leaflet/issues/3249
      animate: false
    };

    if (bounds && bounds.isValid()) {
      this.map.fitBounds(bounds, fitBoundsOptions);
    } else {
      this.map.fitBounds(this.defaultBounds, fitBoundsOptions);
    }
  }

  /**
    * Removes deleted / draws added projects.
    */
  private drawMap(deletedApps: Project[], addedApps: Project[]) {
    // console.log('drawing map');
    // console.log('deleted =', this.deleted);
    // console.log('added =', this.added);

    // remove deleted apps from list and map
    deletedApps.forEach(app => {
      const markerIndex = _.findIndex(this.markerList, { projectId: app._id });
      if (markerIndex >= 0) {
        const markers = this.markerList.splice(markerIndex, 1);
        this.markerClusterGroup.removeLayer(markers[0]);
      }
    });

    // draw added apps
    addedApps.forEach(app => {
      // add marker
      if (app.centroid.length === 2) { // safety check
        const title = `${app.name}\n`
          + `${app.sector}\n`
          + `${app.location}\n`;
        const marker = L.marker(L.latLng(app.centroid[1], app.centroid[0]), { title: title })
          .setIcon(markerIconYellow)
          .on('click', L.Util.bind(this.onMarkerClick, this, app));
        marker.projectId = app._id;
        this.markerList.push(marker); // save to list
        this.markerClusterGroup.addLayer(marker); // save to marker clusters group
      }
    });

    // set visible apps
    this.setVisibleDebounced();
  }

  private onMarkerClick(...args: any[]) {
    const app = args[0] as Project;
    const marker = args[1].target as L.Marker;

    this.createMarkerPopup(app, marker);
  }

  private createMarkerPopup(app: Project, marker: L.Marker) {
    this.applist.toggleCurrentApp(app); // update selected item in app list

    // if there's already a popup, delete it
    let popup = marker.getPopup();
    if (popup) {
      const wasOpen = popup.isOpen();
      popup.remove();
      marker.unbindPopup();
      if (wasOpen) { return; }
    }

    let popupOptions = {};
    // Fix for different viewports on scrolling for map display
    if (this.map.getSize().y < 800) {
      popupOptions = {
        className: 'map-popup-content',
        autoPanPaddingTopLeft: L.point(2, 100),
        autoPanPaddingBottomRight: L.point(2, 30)
      };
    } else {
      popupOptions = {
        className: 'map-popup-content',
        autoPanPaddingTopLeft: L.point(80, 200),
        autoPanPaddingBottomRight: L.point(80, 30)
      };
    }

    // compile marker popup component
    const compFactory = this.resolver.resolveComponentFactory(ProjDetailPopupComponent);
    const compRef = compFactory.create(this.injector);
    compRef.instance.proj = app;
    this.appRef.attachView(compRef.hostView);
    compRef.onDestroy(() => this.appRef.detachView(compRef.hostView));
    const div = document.createElement('div').appendChild(compRef.location.nativeElement);

    popup = L.popup(popupOptions)
      .setLatLng(marker.getLatLng())
      .setContent(div);

    // bind popup to marker so it automatically closes when marker is removed
    marker.bindPopup(popup).openPopup();
  }

  /**
   * Called when list component selects or unselects an app.
   */
  public onHighlightProject(app: Project, show: boolean) {
    // reset icon on previous marker, if any
    if (this.currentMarker) {
      this.currentMarker.setIcon(markerIconYellow);
      this.currentMarker = null;
    }

    // set icon on new marker
    if (show) {
      const marker = _.find(this.markerList, { projectId: app._id });
      if (marker) {
        this.currentMarker = marker;
        marker.setIcon(markerIconYellowLg);
        // FUTURE: zoom in to this app/marker ?
        // FUTURE: show the marker popup ?
        // this.onMarkerClick(app, { target: marker });
      }
    }
  }

  public resetMap() {
    this.fitBounds(); // use default bounds
  }

  /**
   * Center map on specified point, applying offset if needed.
   */
  // TODO: register for list/filter changes and apply offset accordingly ?
  public centerMap(latlng: L.LatLng) {
    let point = this.map.latLngToLayerPoint(latlng);

    if (this.configService.isApplistListVisible) {
      point = point.subtract([(this.applist.clientWidth / 2), 0]);
    }

    point = point.subtract([0, (this.appfilters.clientHeight / 2)]); // filters header is always visible

    this.map.panTo(this.map.layerPointToLatLng(point));
  }

  public onLoadStart() { this.loading = true; }

  public onLoadEnd() { this.loading = false; }
}
